import { getSession, json, unauthorized } from '../../_utils/session.js';
import { getDb } from '../../_utils/db.js';

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await getSession(request, env);
  if (!session) return unauthorized();

  const { guildId } = params;
  const db = getDb(env);

  const [warnings, polls] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) as count FROM warnings WHERE guild_id = ?`,
      args: [guildId],
    }).catch(() => ({ rows: [{ count: 0 }] })),
    db.execute({
      sql: `SELECT COUNT(*) as count FROM polls WHERE guild_id = ?`,
      args: [guildId],
    }).catch(() => ({ rows: [{ count: 0 }] })),
  ]);

  return json({
    warnings: Number(warnings.rows[0]?.count ?? 0),
    polls: Number(polls.rows[0]?.count ?? 0),
  });
}
