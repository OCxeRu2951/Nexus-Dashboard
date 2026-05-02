export function getSessionId(request) {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/nexus_session=([^;]+)/);
  return match ? match[1] : null;
}

export async function getSession(request, env) {
  const sessionId = getSessionId(request);
  if (!sessionId) return null;

  const raw = await env.SESSIONS.get(`session:${sessionId}`);
  if (!raw) return null;

  return JSON.parse(raw);
}

export function setSessionCookie(response, sessionId) {
  const headers = new Headers(response.headers);
  headers.set(
    "Set-Cookie",
    `nexus_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
  );
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export function clearSessionCookie(response) {
  const headers = new Headers(response.headers);
  headers.set(
    "Set-Cookie",
    "nexus_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function unauthorized() {
  return json({ error: "Unauthorized" }, 401);
}

export async function verifyGuildAccess(request, env, guildId) {
  const session = await getSession(request, env);
  if (!session) return null;

  // ユーザーのギルド一覧を取得して管理権限があるか確認
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) return null;
  const guilds = await res.json();

  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) return null;

  // MANAGE_GUILD権限チェック
  const hasPermission =
    (BigInt(guild.permissions) & BigInt(0x20)) === BigInt(0x20);
  if (!hasPermission) return null;

  return session;
}