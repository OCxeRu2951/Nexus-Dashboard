import { getDb } from '../../_utils/db.js';
import { verifyGuildAccess, json, unauthorized } from "../../_utils/session.js";

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await verifyGuildAccess(request, env, params.guildId);
  if (!session) return unauthorized();

  const { guildId } = params;
  const db = getDb(env);

  if (request.method === "GET") {
    const { rows } = await db
      .execute({
        sql: `SELECT * FROM guild_settings WHERE guild_id = ?`,
        args: [guildId],
      })
      .catch(() => ({ rows: [] }));

    return json(
      rows[0] ?? {
        afk_hours: 24,
        poll_days: 7,
        warnings_days: 90,
        application_days: 90,
      },
    );
  }

  if (request.method === "PUT") {
    const body = await request.json();
    const { afk_hours, poll_days, warnings_days, application_days } = body;

    await db.execute({
      sql: `INSERT INTO guild_settings (guild_id, afk_hours, poll_days, warnings_days, application_days)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
              afk_hours = ?,
              poll_days = ?,
              warnings_days = ?,
              application_days = ?`,
      args: [
        guildId,
        afk_hours,
        poll_days,
        warnings_days,
        application_days,
        afk_hours,
        poll_days,
        warnings_days,
        application_days,
      ],
    });

    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
