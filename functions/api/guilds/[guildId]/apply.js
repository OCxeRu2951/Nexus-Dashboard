import { getSession, json, unauthorized } from "../../_utils/session.js";
import { getDb } from "../../_utils/db.js";

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await getSession(request, env);
  if (!session) return unauthorized();

  const { guildId } = params;
  const db = getDb(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const status = url.searchParams.get("status") ?? "all";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "50"),
      100,
    );

    const sql =
      status === "all"
        ? `SELECT * FROM applications WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?`
        : `SELECT * FROM applications WHERE guild_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?`;

    const args = status === "all" ? [guildId, limit] : [guildId, status, limit];

    const { rows } = await db
      .execute({ sql, args })
      .catch(() => ({ rows: [] }));
    return json(rows);
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id is required" }, 400);

    await db.execute({
      sql: `DELETE FROM applications WHERE id = ? AND guild_id = ?`,
      args: [id, guildId],
    });

    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
