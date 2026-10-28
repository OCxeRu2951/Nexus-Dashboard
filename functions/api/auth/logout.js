import { getSessionId, clearSessionCookie } from '../_utils/session.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;

  // リンクを踏ませるだけでログアウトさせられないよう、POST のみ受け付ける
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const sessionId = getSessionId(request);

  if (sessionId) {
    const raw = await env.SESSIONS.get(`session:${sessionId}`).catch(() => null);
    const session = raw ? JSON.parse(raw) : null;

    await env.SESSIONS.delete(`session:${sessionId}`).catch(() => {});

    if (session) {
      await env.SESSIONS.delete(`guilds_cache:${session.user.id}`).catch(() => {});

      // Discord 側のアクセストークンも失効させる
      await fetch('https://discord.com/api/oauth2/token/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          token: session.access_token,
          token_type_hint: 'access_token',
        }),
      }).catch(() => {});
    }
  }

  const response = new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });

  return clearSessionCookie(response);
}
