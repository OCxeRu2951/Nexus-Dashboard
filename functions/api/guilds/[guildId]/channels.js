import { json } from "../../_utils/session.js";
import { requireGuildAdmin } from "../../_utils/access.js";

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const { error } = await requireGuildAdmin(request, env, params.guildId);
  if (error) return error;

  const { guildId } = params;

  const res = await fetch(
    `https://discord.com/api/guilds/${guildId}/channels`,
    {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    },
  );

  if (!res.ok) return json({ error: "Failed to fetch channels" }, 500);
  const channels = await res.json();

  // ?type=forum でフォーラムチャンネル、それ以外はテキストチャンネルを返す
  const type = new URL(request.url).searchParams.get("type") === "forum" ? 15 : 0;
  const textChannels = channels
    .filter((ch) => ch.type === type)
    .sort((a, b) => a.position - b.position)
    .map((ch) => ({ id: ch.id, name: ch.name, parent_id: ch.parent_id }));

  return json(textChannels);
}
