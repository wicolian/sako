import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';

const SESSION_COOKIE = 'sako_wall_session';
const SESSION_DURATION_DAYS = 7;

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Create JWT token
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresAt)
    .setIssuedAt()
    .sign(getSessionSecret());

  // Store session in DB
  await db.wallSession.create({
    data: {
      token,
      expiresAt,
    },
  });

  return token;
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    // Verify JWT signature
    await jwtVerify(token, getSessionSecret());

    // Check if session exists in DB and not expired
    const session = await db.wallSession.findUnique({
      where: { token },
    });

    if (!session) return false;
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await db.wallSession.delete({ where: { token } });
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function deleteSession(token: string): Promise<void> {
  try {
    await db.wallSession.delete({ where: { token } });
  } catch {
    // Ignore errors if session doesn't exist
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  return cookie?.value ?? null;
}

export function validatePassword(password: string): boolean {
  const wallPassword = process.env.WALL_PASSWORD;
  if (!wallPassword) {
    throw new Error('WALL_PASSWORD environment variable is not set');
  }
  return password === wallPassword;
}

// Cleanup expired sessions (can be called from snapshot job)
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.wallSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
