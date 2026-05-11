import { getSession, json, unauthorized } from "../_utils/session.js";
import { getDb } from "../_utils/db.js";

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const session = await getSession(request, env);
  if (!session) return unauthorized();

  // KVキャッシュから取得
  const cacheKey = `guilds_cache:${session.user.id}`;
  let allGuilds = null;

  try {
    const cached = await env.SESSIONS.get(cacheKey);
    if (cached) {
      allGuilds = JSON.parse(cached);
    }
  } catch {}

  if (!allGuilds) {
    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!guildsRes.ok) return json({ error: "Failed to fetch guilds" }, 500);
    allGuilds = await guildsRes.json();

    // KVに5分間キャッシュ
    await env.SESSIONS.put(cacheKey, JSON.stringify(allGuilds), {
      expirationTtl: 300,
    }).catch(() => {});
  }

  const manageable = allGuilds.filter(
    (g) => (BigInt(g.permissions) & BigInt(0x20)) === BigInt(0x20),
  );

  // BotがインストールされているギルドをDBで確認
  const db = getDb(env);
  const { rows } = await db
    .execute(
      `SELECT guild_id FROM settings WHERE guild_id IN (${manageable.map(() => "?").join(",")})`,
      manageable.map((g) => g.id),
    )
    .catch(() => ({ rows: [] }));

  const botGuildIds = new Set(rows.map((r) => r.guild_id));
  const botGuilds = manageable.filter((g) => botGuildIds.has(g.id));

  // メンバー数を取得
  const botGuildsWithCount = await Promise.all(
    botGuilds.map(async (g) => {
      const res = await fetch(
        `https://discord.com/api/guilds/${g.id}?with_counts=true`,
        { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } },
      );
      if (!res.ok) return g;
      const detail = await res.json();
      return {
        ...g,
        approximate_member_count: detail.approximate_member_count,
      };
    }),
  );

  return json(botGuildsWithCount);
}
