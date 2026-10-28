import { getDb } from '../../_utils/db.js';
import { json } from "../../_utils/session.js";
import { requireGuildAdmin } from "../../_utils/access.js";
import { readJsonBody, intInRange } from "../../_utils/validate.js";

// 画面（General.jsx）の入力範囲と同じ
const RANGES = {
  afk_hours:        [1, 720],
  poll_days:        [1, 365],
  warnings_days:    [1, 365],
  application_days: [1, 365],
};

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const { error } = await requireGuildAdmin(request, env, params.guildId);
  if (error) return error;

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
    const body = await readJsonBody(request);
    if (!body) return json({ error: "Invalid body" }, 400);

    const values = Object.fromEntries(
      Object.entries(RANGES).map(([key, [min, max]]) => [key, intInRange(body[key], min, max)]),
    );
    if (Object.values(values).some((v) => v === undefined)) {
      return json({ error: "Invalid settings" }, 400);
    }
    const { afk_hours, poll_days, warnings_days, application_days } = values;

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
