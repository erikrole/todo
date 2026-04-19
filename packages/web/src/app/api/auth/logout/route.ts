export async function POST() {
  const res = Response.json({ ok: true });
  (res.headers as Headers).set("Set-Cookie", "auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return res;
}
