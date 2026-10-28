import {
  setSessionCookie,
  getOAuthState,
  clearOAuthStateCookie,
  SESSION_TTL_SECONDS,
} from "../_utils/session.js";

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = getOAuthState(request);

  if (!code) {
    return clearOAuthStateCookie(Response.redirect(`${env.DASHBOARD_URL}/login?error=no_code`, 302));
  }

  // login.js で発行した state と一致しない戻りは受け付けない（ログイン CSRF 対策）
  if (!state || !expectedState || state !== expectedState) {
    return clearOAuthStateCookie(Response.redirect(`${env.DASHBOARD_URL}/login?error=invalid_state`, 302));
  }

  try {
    // トークン取得
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${env.DASHBOARD_URL}/api/auth/callback`,
      }),
    });

    if (!tokenRes.ok) throw new Error("Token exchange failed");
    const tokenData = await tokenRes.json();

    // ユーザー情報取得
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) throw new Error("User fetch failed");
    const user = await userRes.json();

    // セッション作成（refresh_token は使わないので保存しない）
    const sessionId = crypto.randomUUID();
    const sessionData = {
      user,
      access_token: tokenData.access_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    };

    await env.SESSIONS.put(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
      { expirationTtl: SESSION_TTL_SECONDS },
    );

    const response = Response.redirect(`${env.DASHBOARD_URL}/servers`, 302);
    return clearOAuthStateCookie(setSessionCookie(response, sessionId));
  } catch (err) {
    console.error("OAuth callback error:", err);
    return clearOAuthStateCookie(Response.redirect(
      `${env.DASHBOARD_URL}/login?error=auth_failed`,
      302,
    ));
  }
}
