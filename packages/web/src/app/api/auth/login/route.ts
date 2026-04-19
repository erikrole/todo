import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));

  const authToken = process.env.AUTH_TOKEN;
  if (!authToken || password !== authToken) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  // httpOnly prevents JS access; Secure ensures HTTPS-only; SameSite=Lax works with redirects
  const cookie = `auth_token=${authToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
  (res.headers as Headers).set("Set-Cookie", cookie);
  return res;
}
