import { setOAuthStateCookie } from '../_utils/session.js';

export async function onRequest(ctx) {
  const { env } = ctx;

  // callback で照合する。一致しなければログインさせない（ログイン CSRF 対策）
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: `${env.DASHBOARD_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });

  const response = Response.redirect(
    `https://discord.com/api/oauth2/authorize?${params}`,
    302
  );
  return setOAuthStateCookie(response, state);
}
