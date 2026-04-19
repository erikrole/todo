import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const authToken = process.env.AUTH_TOKEN?.trim();

  if (!authToken) {
    console.error("AUTH_TOKEN env var is not set");
    return NextResponse.next();
  }

  // Only gate API routes — web pages are open
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Bearer token (iOS / MCP / API clients)
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ") && header.slice(7) === authToken) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
