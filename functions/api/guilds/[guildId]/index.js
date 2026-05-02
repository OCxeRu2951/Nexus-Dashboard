import { getSession, json, unauthorized } from '../../_utils/session.js';

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await verifyGuildAccess(request, env, params.guildId);
  if (!session) return unauthorized();

  const { guildId } = params;

  const guildRes = await fetch(`https://discord.com/api/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });

  if (!guildRes.ok) return json({ error: 'Guild not found' }, 404);
  const guild = await guildRes.json();

  return json({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    member_count: guild.approximate_member_count,
  });
}
