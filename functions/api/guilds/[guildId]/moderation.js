import { getSession, json, unauthorized } from '../../_utils/session.js';
import { getDb } from '../../_utils/db.js';

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await verifyGuildAccess(request, env, params.guildId);
  if (!session) return unauthorized();

  const { guildId } = params;
  const db = getDb(env);

  if (request.method === 'GET') {
    const { rows } = await db.execute({
      sql: `SELECT * FROM mod_settings WHERE guild_id = ?`,
      args: [guildId],
    }).catch(() => ({ rows: [] }));

    const row = rows[0] ?? {};
    return json({
      log_channel_id: row.log_channel_id ?? '',
      warn_threshold_timeout: row.warn_threshold_timeout ?? 3,
      warn_threshold_ban: row.warn_threshold_ban ?? 5,
      timeout_duration_min: row.timeout_duration_min ?? 60,
      automod_spam: Boolean(row.automod_spam),
      automod_invite: Boolean(row.automod_invite),
    });
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const {
      log_channel_id,
      warn_threshold_timeout,
      warn_threshold_ban,
      timeout_duration_min,
      automod_spam,
      automod_invite,
    } = body;

    await db.execute({
      sql: `INSERT INTO mod_settings (
              guild_id, log_channel_id, warn_threshold_timeout,
              warn_threshold_ban, timeout_duration_min,
              automod_spam, automod_invite
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
              log_channel_id = ?,
              warn_threshold_timeout = ?,
              warn_threshold_ban = ?,
              timeout_duration_min = ?,
              automod_spam = ?,
              automod_invite = ?`,
      args: [
        guildId,
        log_channel_id || null,
        warn_threshold_timeout,
        warn_threshold_ban,
        timeout_duration_min,
        automod_spam ? 1 : 0,
        automod_invite ? 1 : 0,
        log_channel_id || null,
        warn_threshold_timeout,
        warn_threshold_ban,
        timeout_duration_min,
        automod_spam ? 1 : 0,
        automod_invite ? 1 : 0,
      ],
    });

    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
