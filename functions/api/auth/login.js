export async function onRequest(ctx) {
  const { env } = ctx;

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: `${env.DASHBOARD_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'identify guilds',
  });

  return Response.redirect(
    `https://discord.com/api/oauth2/authorize?${params}`,
    302
  );
}
