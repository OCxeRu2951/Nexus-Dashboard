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
  const manageable = allGuilds.filter(g =>
    (BigInt(g.permissions) & BigInt(0x20)) === BigInt(0x20) // MANAGE_GUILD
  );

  // BotがインストールされているギルドをDBで確認
  const db = getDb(env);
  const { rows } = await db.execute(
    `SELECT guild_id FROM settings WHERE guild_id IN (${manageable.map(() => '?').join(',')})`,
    manageable.map(g => g.id)
  ).catch(() => ({ rows: [] }));

  const botGuildIds = new Set(rows.map(r => r.guild_id));
  const botGuilds = manageable.filter(g => botGuildIds.has(g.id));

  return json(botGuilds);
}
