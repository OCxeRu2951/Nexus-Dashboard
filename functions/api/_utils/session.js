// __Host- 付きの Cookie は Secure・Path=/・Domain なしでしか設定できないため、
// 同じドメインの他のサブドメインから上書きされない
const SESSION_COOKIE = "__Host-nexus_session";
const STATE_COOKIE   = "__Host-nexus_oauth_state";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7日
const STATE_TTL_SECONDS = 60 * 10;

export function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") ?? "";
  for (const part of cookie.split(";")) {
    const i = part.indexOf("=");
    if (i !== -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null;
  }
  return null;
}

export function getSessionId(request) {
  return getCookie(request, SESSION_COOKIE);
}

export function getOAuthState(request) {
  return getCookie(request, STATE_COOKIE);
}

export async function getSession(request, env) {
  const sessionId = getSessionId(request);
  if (!sessionId) return null;

  const raw = await env.SESSIONS.get(`session:${sessionId}`);
  if (!raw) return null;

  return JSON.parse(raw);
}

function withCookie(response, cookie) {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export function setSessionCookie(response, sessionId) {
  return withCookie(
    response,
    `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  );
}

export function clearSessionCookie(response) {
  return withCookie(response, `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

// OAuth の state（ログイン CSRF 対策）。Discord からの戻り（トップレベルの GET）で届くよう SameSite=Lax
export function setOAuthStateCookie(response, state) {
  return withCookie(
    response,
    `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}`,
  );
}

export function clearOAuthStateCookie(response) {
  return withCookie(response, `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
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

export function forbidden() {
  return json({ error: "Forbidden" }, 403);
}
