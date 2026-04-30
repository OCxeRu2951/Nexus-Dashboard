import { setSessionCookie, json } from "../_utils/session.js";

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return Response.redirect(`${env.DASHBOARD_URL}/login?error=no_code`, 302);
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

    // セッション作成
    const sessionId = crypto.randomUUID();
    const sessionData = {
      user,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    };

    await env.SESSIONS.put(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
      { expirationTtl: 60 * 60 * 24 * 7 }, // 7日
    );

    const response = Response.redirect(`${env.DASHBOARD_URL}/servers`, 302);
    return setSessionCookie(response, sessionId);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return Response.redirect(
      `${env.DASHBOARD_URL}/login?error=auth_failed`,
      302,
    );
  }
}
