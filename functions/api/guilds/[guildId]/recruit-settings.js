import { getDb } from "../../_utils/db.js";
import { json } from "../../_utils/session.js";
import { parseRoleIds, requireGuildAdmin } from "../../_utils/access.js";
import {
  SNOWFLAKE,
  readJsonBody,
  snowflakeOrNull,
  rejectForeignChannels,
} from "../../_utils/validate.js";

// 募集設定（管理者のみ）
//   GET /api/guilds/:guildId/recruit-settings
//   PUT /api/guilds/:guildId/recruit-settings
//       { list_channel_id, thread_mode, forum_channel_id, viewer_role_ids: [] }
//
// Bot の /recruit-config と同じ recruit_settings を更新する。
// 更新リストの投稿・移動は Bot が行うため、保存後に refresh_list を依頼する。
const THREAD_MODES = ["thread", "forum"];
const VIEWER_ROLES_MAX = 25;

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const { session, error } = await requireGuildAdmin(request, env, params.guildId);
  if (error) return error;

  const { guildId } = params;
  const db = getDb(env);

  if (request.method === "GET") {
    const { rows } = await db
      .execute({ sql: `SELECT * FROM recruit_settings WHERE guild_id = ?`, args: [guildId] })
      .catch(() => ({ rows: [] }));
    const row = rows[0];

    return json({
      list_channel_id:  row?.list_channel_id ?? "",
      thread_mode:      THREAD_MODES.includes(row?.thread_mode) ? row.thread_mode : "thread",
      forum_channel_id: row?.forum_channel_id ?? "",
      viewer_role_ids:  parseRoleIds(row?.viewer_role_ids),
    });
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (!body) return json({ error: "Invalid body" }, 400);

    const listChannelId  = snowflakeOrNull(body.list_channel_id);
    const forumChannelId = snowflakeOrNull(body.forum_channel_id);
    const threadMode     = body.thread_mode ?? "thread";
    const roleIds        = Array.isArray(body.viewer_role_ids) ? body.viewer_role_ids.map(String) : [];

    if (listChannelId === undefined || forumChannelId === undefined) {
      return json({ error: "Invalid channel id" }, 400);
    }
    if (!THREAD_MODES.includes(threadMode)) return json({ error: "Invalid thread_mode" }, 400);
    if (threadMode === "forum" && !forumChannelId) {
      return json({ error: "forum_channel_id is required for forum mode" }, 400);
    }
    if (roleIds.length > VIEWER_ROLES_MAX || roleIds.some((id) => !SNOWFLAKE.test(id))) {
      return json({ error: "Invalid viewer_role_ids" }, 400);
    }

    const foreign = await rejectForeignChannels(env, guildId, [listChannelId, forumChannelId]);
    if (foreign) return foreign;

    const uniqueRoles = [...new Set(roleIds)];
    const rolesJson = uniqueRoles.length > 0 ? JSON.stringify(uniqueRoles) : null;

    await db.batch(
      [
        {
          sql: `INSERT INTO recruit_settings (guild_id, list_channel_id, thread_mode, forum_channel_id, viewer_role_ids)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(guild_id) DO UPDATE SET
                  list_channel_id  = excluded.list_channel_id,
                  thread_mode      = excluded.thread_mode,
                  forum_channel_id = excluded.forum_channel_id,
                  viewer_role_ids  = excluded.viewer_role_ids`,
          args: [guildId, listChannelId, threadMode, forumChannelId, rolesJson],
        },
        {
          sql: `INSERT INTO recruit_actions (guild_id, action, requested_by, created_at)
                VALUES (?, 'refresh_list', ?, ?)`,
          args: [guildId, String(session.user.id), Date.now()],
        },
      ],
      "write",
    );

    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
