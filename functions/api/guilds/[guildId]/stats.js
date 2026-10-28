import { getDb } from "../../_utils/db.js";
import { json } from "../../_utils/session.js";
import { requireGuildAdmin } from "../../_utils/access.js";

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const { error } = await requireGuildAdmin(request, env, params.guildId);
  if (error) return error;

  const { guildId } = params;
  const db = getDb(env);

  const [warnings, polls, recruitsOpen, guildRes] = await Promise.all([
    db
      .execute({
        sql: `SELECT COUNT(*) as count FROM warnings WHERE guild_id = ?`,
        args: [guildId],
      })
      .catch(() => ({ rows: [{ count: 0 }] })),
    db
      .execute({
        sql: `SELECT COUNT(*) as count FROM polls WHERE guild_id = ?`,
        args: [guildId],
      })
      .catch(() => ({ rows: [{ count: 0 }] })),
    db
      .execute({
        sql: `SELECT COUNT(*) as count FROM recruits WHERE guild_id = ? AND status = 'open'`,
        args: [guildId],
      })
      .catch(() => ({ rows: [{ count: 0 }] })),
    fetch(`https://discord.com/api/guilds/${guildId}?with_counts=true`, {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    }),
  ]);

  const guild = guildRes.ok ? await guildRes.json() : null;

  return json({
    members: guild?.approximate_member_count ?? 0,
    warnings: Number(warnings.rows[0]?.count ?? 0),
    polls: Number(polls.rows[0]?.count ?? 0),
    recruits: Number(recruitsOpen.rows[0]?.count ?? 0),
  });
}
