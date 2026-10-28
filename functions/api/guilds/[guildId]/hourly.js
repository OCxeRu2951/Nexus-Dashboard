import { getDb } from '../../_utils/db.js';
import { json } from "../../_utils/session.js";
import { requireGuildAdmin } from "../../_utils/access.js";
import {
  readJsonBody,
  snowflakeOrNull,
  textOrNull,
  mediaUrlOrNull,
  rejectForeignChannels,
} from "../../_utils/validate.js";

// 24時間 × (全曜日 + 7曜日) + デフォルト × (全曜日 + 7曜日)
const MESSAGES_MAX = 200;
// Discord の上限
const CONTENT_MAX = 2000;
const EMBED_TITLE_MAX = 256;
const EMBED_DESCRIPTION_MAX = 4096;
const EMBED_FOOTER_MAX = 2048;
const EMBED_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * "default" / "default_3" / "9" / "9_3" → { hour, dow }。不正なキーは null
 */
function parseKey(key) {
  let hour, dow;

  if (key === "default") {
    hour = -1;
    dow = null;
  } else if (key.startsWith("default_")) {
    hour = -1;
    dow = Number(key.split("_")[1]);
  } else if (key.includes("_")) {
    const parts = key.split("_");
    hour = Number(parts[0]);
    dow = Number(parts[1]);
  } else {
    hour = Number(key);
    dow = null;
  }

  if (!Number.isInteger(hour) || hour < -1 || hour > 23) return null;
  if (dow !== null && (!Number.isInteger(dow) || dow < 0 || dow > 6)) return null;
  return { hour, dow };
}

/**
 * Bot が使う項目だけを取り出して検証する。不正なら undefined
 */
function normalizeEmbed(embed) {
  if (embed == null) return null;
  if (typeof embed !== "object" || Array.isArray(embed)) return undefined;

  const normalized = {
    title:       textOrNull(embed.title, EMBED_TITLE_MAX),
    description: textOrNull(embed.description, EMBED_DESCRIPTION_MAX),
    footer:      textOrNull(embed.footer, EMBED_FOOTER_MAX),
    color:       embed.color == null || embed.color === ""
      ? null
      : EMBED_COLOR.test(String(embed.color)) ? String(embed.color) : undefined,
    image:       mediaUrlOrNull(embed.image),
    thumbnail:   mediaUrlOrNull(embed.thumbnail),
  };
  if (Object.values(normalized).some((v) => v === undefined)) return undefined;

  // 空の項目は保存しない（従来の保存形式と同じく、入力された項目だけを持つ）
  return Object.fromEntries(Object.entries(normalized).filter(([, v]) => v != null));
}

function normalizeMessage(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return undefined;

  const normalized = {
    content:  textOrNull(msg.content, CONTENT_MAX),
    image:    mediaUrlOrNull(msg.image),
    file_url: mediaUrlOrNull(msg.file_url),
    embed:    normalizeEmbed(msg.embed),
  };
  return Object.values(normalized).some((v) => v === undefined) ? undefined : normalized;
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const { error } = await requireGuildAdmin(request, env, params.guildId);
  if (error) return error;

  const { guildId } = params;
  const db = getDb(env);

  if (request.method === "GET") {
    const [settingsRows, messageRows] = await Promise.all([
      db
        .execute({
          sql: `SELECT hourly_channel_id FROM settings WHERE guild_id = ?`,
          args: [guildId],
        })
        .catch(() => ({ rows: [] })),
      db
        .execute({
          sql: `SELECT * FROM hourly_messages WHERE guild_id = ?`,
          args: [guildId],
        })
        .catch(() => ({ rows: [] })),
    ]);

    const messages = {};
    for (const row of messageRows.rows) {
      const key = row.hour === -1 ? "default" : String(row.hour);
      messages[key] = {
        content: row.content ?? "",
        image: row.image_url ?? "",
        file_url: row.file_url ?? "",
        embed: row.embed ? JSON.parse(row.embed) : null,
      };
    }

    return json({
      channel_id: settingsRows.rows[0]?.hourly_channel_id ?? "",
      messages,
    });
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (!body) return json({ error: "Invalid body" }, 400);

    const channelId = snowflakeOrNull(body.channel_id);
    if (channelId === undefined) return json({ error: "Invalid channel id" }, 400);

    const messages = body.messages ?? {};
    if (typeof messages !== "object" || Array.isArray(messages)) {
      return json({ error: "Invalid messages" }, 400);
    }
    const entries = Object.entries(messages);
    if (entries.length > MESSAGES_MAX) return json({ error: "Too many messages" }, 400);

    const rows = [];
    for (const [key, raw] of entries) {
      const slot = parseKey(key);
      if (!slot) return json({ error: `Invalid key: ${key}` }, 400);

      const msg = normalizeMessage(raw);
      if (!msg) return json({ error: `Invalid message: ${key}` }, 400);
      if (!msg.content && !msg.image && !msg.file_url && !msg.embed) continue;

      rows.push({ ...slot, ...msg });
    }

    const foreign = await rejectForeignChannels(env, guildId, [channelId]);
    if (foreign) return foreign;

    // チャンネルIDの更新と、メッセージの全削除・再挿入をまとめて行う
    // （途中で失敗したときに設定が消えたままにならないように）
    await db.batch(
      [
        {
          sql: `INSERT INTO settings (guild_id, hourly_channel_id) VALUES (?, ?)
              ON CONFLICT(guild_id) DO UPDATE SET hourly_channel_id = ?`,
          args: [guildId, channelId, channelId],
        },
        {
          sql: `DELETE FROM hourly_messages WHERE guild_id = ?`,
          args: [guildId],
        },
        ...rows.map((row) => ({
          sql: `INSERT INTO hourly_messages (guild_id, hour, day_of_week, content, image_url, file_url, embed, enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          args: [
            guildId,
            row.hour,
            row.dow,
            row.content,
            row.image,
            row.file_url,
            row.embed ? JSON.stringify(row.embed) : null,
          ],
        })),
      ],
      "write",
    );

    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
