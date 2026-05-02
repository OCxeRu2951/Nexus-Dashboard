import { getSession, json, unauthorized } from "../../_utils/session.js";

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await verifyGuildAccess(request, env, params.guildId);
  if (!session) return unauthorized();

  const res = await fetch(
    `https://discord.com/api/guilds/${params.guildId}/roles`,
    {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    },
  );

  if (!res.ok) return json({ error: "Failed" }, 500);
  const roles = await res.json();

  return json(
    roles
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.color })),
  );
}
