import { getSession, json, unauthorized } from '../_utils/session.js';
import { getDb } from '../_utils/db.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const session = await getSession(request, env);
  if (!session) return unauthorized();

  // ユーザーのギルド一覧をDiscord APIから取得
  const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!guildsRes.ok) return json({ error: 'Failed to fetch guilds' }, 500);
  const allGuilds = await guildsRes.json();

  // 管理権限のあるギルドのみ
  const botGuilds = manageable.filter((g) => botGuildIds.has(g.id));

  // approximate_member_countを取得するため詳細情報を追加取得
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
