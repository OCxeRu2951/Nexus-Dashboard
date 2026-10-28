import { getDb } from "../../_utils/db.js";
import { json } from "../../_utils/session.js";
import { requireGuildAdmin } from "../../_utils/access.js";
import { readJsonBody, snowflakeOrNull, rejectForeignChannels } from "../../_utils/validate.js";

const NOTIFY_TYPES = ["dm", "channel"];

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const { error } = await requireGuildAdmin(request, env, params.guildId);
  if (error) return error;

  const { guildId } = params;
  const db = getDb(env);

  if (request.method === "GET") {
    const { rows } = await db
      .execute({
        sql: `SELECT * FROM apply_settings WHERE guild_id = ?`,
        args: [guildId],
      })
      .catch(() => ({ rows: [] }));

    return json(
      rows[0] ?? {
        apply_channel_id: "",
        operator_role_id: "",
        notify_type: "dm",
        notify_target: "",
        admin_channel_id: "",
      },
    );
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (!body) return json({ error: "Invalid body" }, 400);

    const apply_channel_id = snowflakeOrNull(body.apply_channel_id);
    const operator_role_id = snowflakeOrNull(body.operator_role_id);
    const notify_target    = snowflakeOrNull(body.notify_target);
    const admin_channel_id = snowflakeOrNull(body.admin_channel_id);
    const notify_type      = body.notify_type || "dm";

    if (
      [apply_channel_id, operator_role_id, notify_target, admin_channel_id].some((v) => v === undefined)
      || !NOTIFY_TYPES.includes(notify_type)
    ) {
      return json({ error: "Invalid settings" }, 400);
    }

    // notify_target は通知方法がチャンネルのときだけチャンネルIDとして使われる
    const foreign = await rejectForeignChannels(env, guildId, [
      apply_channel_id,
      admin_channel_id,
      notify_type === "channel" ? notify_target : null,
    ]);
    if (foreign) return foreign;

    await db.execute({
      sql: `INSERT INTO apply_settings (guild_id, apply_channel_id, operator_role_id, notify_type, notify_target, admin_channel_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
              apply_channel_id = ?,
              operator_role_id = ?,
              notify_type = ?,
              notify_target = ?,
              admin_channel_id = ?`,
      args: [
        guildId,
        apply_channel_id || null,
        operator_role_id || null,
        notify_type || "dm",
        notify_target || null,
        admin_channel_id || null,
        apply_channel_id || null,
        operator_role_id || null,
        notify_type || "dm",
        notify_target || null,
        admin_channel_id || null,
      ],
    });

    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
