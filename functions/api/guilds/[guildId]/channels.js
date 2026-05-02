import { getSession, json, unauthorized } from "../../_utils/session.js";

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await verifyGuildAccess(request, env, params.guildId);
  if (!session) return unauthorized();

  const { guildId } = params;

  const res = await fetch(
    `https://discord.com/api/guilds/${guildId}/channels`,
    {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    },
  );

  if (!res.ok) return json({ error: "Failed to fetch channels" }, 500);
  const channels = await res.json();

  // テキストチャンネルのみ返す
  const textChannels = channels
    .filter((ch) => ch.type === 0)
    .sort((a, b) => a.position - b.position)
    .map((ch) => ({ id: ch.id, name: ch.name, parent_id: ch.parent_id }));

  return json(textChannels);
}
