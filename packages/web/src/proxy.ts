import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const authToken = process.env["NEXT_PUBLIC_AUTH_TOKEN"];

  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!authToken || token !== authToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: "/api/:path*",
};
