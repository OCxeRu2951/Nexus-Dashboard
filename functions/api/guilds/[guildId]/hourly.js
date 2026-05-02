import { getSession, json, unauthorized } from '../../_utils/session.js';
import { getDb } from '../../_utils/db.js';

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await getSession(request, env);
  if (!session) return unauthorized();

  const { guildId } = params;
  const db = getDb(env);

  if (request.method === 'GET') {
    const [settingsRows, messageRows] = await Promise.all([
      db.execute({
        sql: `SELECT hourly_channel_id FROM settings WHERE guild_id = ?`,
        args: [guildId],
      }).catch(() => ({ rows: [] })),
      db.execute({
        sql: `SELECT * FROM hourly_messages WHERE guild_id = ?`,
        args: [guildId],
      }).catch(() => ({ rows: [] })),
    ]);

    const messages = {};
    for (const row of messageRows.rows) {
      const key = row.hour === -1 ? 'default' : String(row.hour);
      messages[key] = {
        content: row.content ?? "",
        image: row.image_url ?? "",
        file_url: row.file_url ?? "",
        embed: row.embed ? JSON.parse(row.embed) : null,
      };
    }

    return json({
      channel_id: settingsRows.rows[0]?.hourly_channel_id ?? '',
      messages,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json();
    const { channel_id, messages } = body;

    // チャンネルIDを更新
    await db.execute({
      sql: `INSERT INTO settings (guild_id, hourly_channel_id) VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET hourly_channel_id = ?`,
      args: [guildId, channel_id || null, channel_id || null],
    });

    // 既存のメッセージを全削除して再挿入
    await db.execute({
      sql: `DELETE FROM hourly_messages WHERE guild_id = ?`,
      args: [guildId],
    });

    for (const [key, msg] of Object.entries(messages ?? {})) {
      const hour = key === "default" ? -1 : parseInt(key, 10);
      if (key !== "default" && isNaN(hour)) continue;

      // 空メッセージはスキップ
      if (!msg.content && !msg.image && !msg.file_url && !msg.embed) continue;

      await db.execute({
        sql: `INSERT INTO hourly_messages (guild_id, hour, content, image_url, file_url, embed, enabled)
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
        args: [
          guildId,
          hour,
          msg.content || null,
          msg.image || null,
          msg.file_url || null,
          msg.embed ? JSON.stringify(msg.embed) : null,
        ],
      });
    }

    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
