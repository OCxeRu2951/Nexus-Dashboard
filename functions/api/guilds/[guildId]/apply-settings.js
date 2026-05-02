import { getSession, json, unauthorized } from "../../_utils/session.js";
import { getDb } from "../../_utils/db.js";

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await getSession(request, env);
  if (!session) return unauthorized();

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
    const body = await request.json();
    const {
      apply_channel_id,
      operator_role_id,
      notify_type,
      notify_target,
      admin_channel_id,
    } = body;

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
