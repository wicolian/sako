import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Max path length (filesystem limit is ~255 per segment, 4096 total)
const MAX_PATH_LENGTH = 500;

// Suspicious patterns: repeated %25 causes encoding explosion
const SUSPICIOUS_PATTERNS = [
  /%25{4,}/, // 4+ consecutive %25
  /%25%25%25/, // Triple-encoded %
  /\.{3,}/, // Path traversal attempts
];

function tryDecode(str: string): string {
  try {
    let decoded = str;
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    return decoded;
  } catch {
    return str;
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Reject overly long paths
  if (path.length > MAX_PATH_LENGTH) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // 2. Reject suspicious encoding patterns
  const decoded = tryDecode(path);
  if (SUSPICIOUS_PATTERNS.some((re) => re.test(decoded))) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  return NextResponse.next();
}
