import { getSessionId, clearSessionCookie } from '../_utils/session.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const sessionId = getSessionId(request);

  if (sessionId) {
    await env.SESSIONS.delete(`session:${sessionId}`).catch(() => {});
  }

  const response = new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });

  return clearSessionCookie(response);
}
