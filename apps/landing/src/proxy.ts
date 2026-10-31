import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk is optional for the marketing site. Turn it on only when both keys are set.
const hasClerkSecret = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

function applyCommonHeaders(response: NextResponse) {
  response.headers.set(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), usb=()"
  );
}

const clerkHandler = clerkMiddleware(async (auth) => {
  const response = NextResponse.next();

  applyCommonHeaders(response);

  // Expose a lightweight, cookie-based auth hint for marketing UI decisions
  // without loading the Clerk browser bundle on marketing pages.
  const { userId } = await auth();
  if (userId) {
    response.cookies.set("sako_signed_in", "true", {
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  } else {
    response.cookies.delete("sako_signed_in");
  }

  return response;
});

export default function proxy(req: NextRequest, event: any) {
  if (!hasClerkSecret) {
    const response = NextResponse.next();
    applyCommonHeaders(response);
    return response;
  }
  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|favicons/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};


