import { getDb } from '../../_utils/db.js';
import { json } from "../../_utils/session.js";
import { requireGuildAdmin } from "../../_utils/access.js";
import {
  readJsonBody,
  intInRange,
  snowflakeOrNull,
  rejectForeignChannels,
} from "../../_utils/validate.js";

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const { error } = await requireGuildAdmin(request, env, params.guildId);
  if (error) return error;

  const { guildId } = params;
  const db = getDb(env);

  if (request.method === "GET") {
    const { rows } = await db
      .execute({
        sql: `SELECT * FROM mod_settings WHERE guild_id = ?`,
        args: [guildId],
      })
      .catch(() => ({ rows: [] }));

    const row = rows[0] ?? {};
    return json({
      log_channel_id: row.log_channel_id ?? "",
      warn_threshold_timeout: row.warn_threshold_timeout ?? 3,
      warn_threshold_ban: row.warn_threshold_ban ?? 5,
      timeout_duration_min: row.timeout_duration_min ?? 60,
      automod_spam: Boolean(row.automod_spam),
      automod_invite: Boolean(row.automod_invite),
    });
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (!body) return json({ error: "Invalid body" }, 400);

    // 範囲は画面（Moderation.jsx）の入力範囲と同じ
    const log_channel_id         = snowflakeOrNull(body.log_channel_id);
    const warn_threshold_timeout = intInRange(body.warn_threshold_timeout, 1, 100);
    const warn_threshold_ban     = intInRange(body.warn_threshold_ban, 1, 100);
    const timeout_duration_min   = intInRange(body.timeout_duration_min, 1, 40320);
    const { automod_spam, automod_invite } = body;

    if (
      [log_channel_id, warn_threshold_timeout, warn_threshold_ban, timeout_duration_min]
        .some((v) => v === undefined)
    ) {
      return json({ error: "Invalid settings" }, 400);
    }

    const foreign = await rejectForeignChannels(env, guildId, [log_channel_id]);
    if (foreign) return foreign;

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

  return json({ error: "Method not allowed" }, 405);
}
