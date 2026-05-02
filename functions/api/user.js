import { getSession, json, unauthorized } from './_utils/session.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const session = await verifyGuildAccess(request, env, params.guildId);
  if (!session) return unauthorized();

  return json(session.user);
}
