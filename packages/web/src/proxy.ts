import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const authToken = process.env.AUTH_TOKEN;

  if (!authToken) {
    console.error("AUTH_TOKEN env var is not set");
    return NextResponse.next();
  }

  // Cookie (browser sessions)
  const cookie = req.cookies.get("auth_token")?.value;
  if (cookie === authToken) return NextResponse.next();

  // Bearer token (MCP / API clients / iOS)
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ") && header.slice(7) === authToken) {
    return NextResponse.next();
  }

  // Auth routes are always public (login/logout must work unauthenticated)
  if (req.nextUrl.pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // API requests → 401 JSON
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Page requests → redirect to login
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
