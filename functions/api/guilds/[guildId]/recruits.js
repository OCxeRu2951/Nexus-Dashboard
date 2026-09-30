import { getDb } from "../../_utils/db.js";
import { json, unauthorized } from "../../_utils/session.js";
import {
  resolveGuildAccess,
  fetchMemberRoleIds,
  fetchGuildRoles,
  fetchGuildChannels,
  computeViewableChannelIds,
} from "../../_utils/access.js";

// 募集一覧 / 締切依頼
//   GET  /api/guilds/:guildId/recruits?status=all|open|closed&limit=100
//   POST /api/guilds/:guildId/recruits   { action: "close", recruit_id }
//
// 管理者: 全件閲覧・全件締切
// メンバー: 自分が Discord 上で閲覧できるチャンネルの募集のみ閲覧。
//           自分の募集（メッセージ管理権限があれば他人の募集も）を締切できる
//
// 締切はダッシュボードから直接行わず recruit_actions に依頼を書き込み、Botが実行する
// （Discord上の投稿更新・参加者へのメンション通知・更新リストの更新をBot側で一元化するため）
const STATUSES = ["all", "open", "closed"];

function forbidden() {
  return json({ error: "Forbidden" }, 403);
}

/**
 * メンバーが閲覧できるチャンネルの集合と、チャンネル名の対応表を返す。
 * 管理者は viewable = null（制限なし）。
 */
async function loadChannelContext(env, guildId, access) {
  const channels = await fetchGuildChannels(env, guildId).catch(() => []);
  const names = new Map(channels.map((c) => [String(c.id), c.name]));

  if (access.access === "admin") return { viewable: null, names };

  const memberRoleIds =
    access.memberRoleIds ?? (await fetchMemberRoleIds(env, guildId, access.userId).catch(() => null));
  if (!memberRoleIds) return { viewable: new Set(), names };

  const roles = await fetchGuildRoles(env, guildId).catch(() => []);
  const viewable = computeViewableChannelIds({
    guildId,
    userId: access.userId,
    memberRoleIds,
    roles,
    channels,
  });
  return { viewable, names };
}

// 非公開スレッド（view_channel_id = NULL）や旧データはスレッドIDで判定されるため、
// チャンネル一覧に存在せずメンバーには表示されない
function visibilityKey(recruit) {
  return String(recruit.view_channel_id ?? recruit.channel_id);
}

function canClose(access, recruit) {
  if (recruit.status !== "open") return false;
  if (access.access === "admin" || access.canManageMessages) return true;
  return String(recruit.author_id) === access.userId;
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const { guildId } = params;

  const access = await resolveGuildAccess(request, env, guildId);
  if (!access) return unauthorized();
  if (access.access === "none") return forbidden();

  const db = getDb(env);

  // ---------------- 一覧 ----------------
  if (request.method === "GET") {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "all";
    if (!STATUSES.includes(status)) return json({ error: "Invalid status" }, 400);

    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1),
      100,
    );

    // SELECT * にしているのは、Bot更新前（追加列がないDB）でも一覧を返せるようにするため
    const { rows: allRecruits } = await db
      .execute({
        sql:
          status === "all"
            ? `SELECT * FROM recruits WHERE guild_id = ?
               ORDER BY (status = 'open') DESC, created_at DESC LIMIT ?`
            : `SELECT * FROM recruits WHERE guild_id = ? AND status = ?
               ORDER BY created_at DESC LIMIT ?`,
        args: status === "all" ? [guildId, limit] : [guildId, status, limit],
      })
      .catch(() => ({ rows: [] }));

    const { viewable, names } = await loadChannelContext(env, guildId, access);
    const recruits = viewable
      ? allRecruits.filter((r) => viewable.has(visibilityKey(r)))
      : allRecruits;

    const base = {
      access:              access.access,
      user_id:             access.userId,
      can_manage_messages: access.canManageMessages,
    };
    if (recruits.length === 0) return json({ ...base, recruits: [] });

    const ids = recruits.map((r) => Number(r.id));
    const placeholders = ids.map(() => "?").join(", ");

    const [{ rows: members }, { rows: pending }] = await Promise.all([
      db
        .execute({
          sql: `SELECT * FROM recruit_members
                WHERE guild_id = ? AND recruit_id IN (${placeholders})
                ORDER BY joined_at ASC`,
          args: [guildId, ...ids],
        })
        .catch(() => ({ rows: [] })),
      db
        .execute({
          sql: `SELECT recruit_id FROM recruit_actions
                WHERE guild_id = ? AND action = 'close' AND processed_at IS NULL
                  AND recruit_id IN (${placeholders})`,
          args: [guildId, ...ids],
        })
        .catch(() => ({ rows: [] })),
    ]);

    const membersByRecruit = new Map(ids.map((id) => [id, []]));
    for (const m of members) {
      membersByRecruit.get(Number(m.recruit_id))?.push({
        user_id:   String(m.user_id),
        username:  m.username ?? null,
        joined_at: Number(m.joined_at),
      });
    }
    const pendingIds = new Set(pending.map((p) => Number(p.recruit_id)));
    const toNumberOrNull = (v) => (v == null ? null : Number(v));

    return json({
      ...base,
      recruits: recruits.map((r) => {
        const id = Number(r.id);
        const list = membersByRecruit.get(id) ?? [];
        return {
          id,
          channel_id:    String(r.channel_id),
          channel_name:  names.get(String(r.channel_id)) ?? null,
          message_id:    r.message_id ?? null,
          thread_id:     r.thread_id ?? null,
          thread_kind:   r.thread_kind ?? null,
          author_id:     String(r.author_id),
          author_name:   r.author_name ?? null,
          title:         r.title,
          description:   r.description ?? null,
          capacity:      toNumberOrNull(r.capacity),
          end_at:        toNumberOrNull(r.end_at),
          status:        r.status,
          close_reason:  r.close_reason ?? null,
          created_at:    Number(r.created_at),
          closed_at:     toNumberOrNull(r.closed_at),
          members:       list,
          is_mine:       String(r.author_id) === access.userId,
          joined:        list.some((m) => m.user_id === access.userId),
          can_close:     canClose(access, r),
          close_pending: pendingIds.has(id),
        };
      }),
    });
  }

  // ---------------- 締切依頼 ----------------
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (body?.action !== "close") return json({ error: "Invalid action" }, 400);

    const recruitId = Number(body.recruit_id);
    if (!Number.isInteger(recruitId) || recruitId <= 0) {
      return json({ error: "Invalid recruit_id" }, 400);
    }

    const { rows } = await db.execute({
      sql:  `SELECT * FROM recruits WHERE id = ? AND guild_id = ?`,
      args: [recruitId, guildId],
    });
    const recruit = rows[0];
    if (!recruit) return json({ error: "Not found" }, 404);

    // メンバーは閲覧できない募集を操作できない（存在も明かさない）
    if (access.access !== "admin") {
      const { viewable } = await loadChannelContext(env, guildId, access);
      if (!viewable.has(visibilityKey(recruit))) return json({ error: "Not found" }, 404);
    }

    if (recruit.status !== "open") return json({ error: "Already closed" }, 409);
    if (!canClose(access, recruit)) return forbidden();

    const { rows: existing } = await db.execute({
      sql: `SELECT id FROM recruit_actions
            WHERE guild_id = ? AND recruit_id = ? AND action = 'close' AND processed_at IS NULL`,
      args: [guildId, recruitId],
    });

    if (existing.length === 0) {
      await db.execute({
        sql: `INSERT INTO recruit_actions (guild_id, recruit_id, action, requested_by, created_at)
              VALUES (?, ?, 'close', ?, ?)`,
        args: [guildId, recruitId, access.userId, Date.now()],
      });
    }

    return json({ ok: true, queued: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
