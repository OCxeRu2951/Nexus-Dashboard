import { getDb } from "../../_utils/db.js";
import { verifyGuildAccess, json, unauthorized } from "../../_utils/session.js";

// 募集一覧（閲覧専用）
// GET /api/guilds/:guildId/recruits?status=all|open|closed&limit=50
//
// 募集の作成・参加・締切はBot側（/recruit, b!, ボタン）で行う。
// 締切やメッセージ更新をダッシュボードから行うとDiscord上の投稿と不整合になるため、
// ここでは参照のみ提供する。
const STATUSES = ["all", "open", "closed"];

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const session = await verifyGuildAccess(request, env, params.guildId);
  if (!session) return unauthorized();

  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const { guildId } = params;
  const db = getDb(env);
  const url = new URL(request.url);

  const status = url.searchParams.get("status") ?? "all";
  if (!STATUSES.includes(status)) return json({ error: "Invalid status" }, 400);

  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    100,
  );

  // SELECT * にしているのは、Bot更新前（author_name 列がないDB）でも一覧を返せるようにするため
  const { rows: recruits } = await db
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

  if (recruits.length === 0) return json([]);

  const ids = recruits.map((r) => Number(r.id));
  const { rows: members } = await db
    .execute({
      sql: `SELECT * FROM recruit_members
            WHERE guild_id = ? AND recruit_id IN (${ids.map(() => "?").join(", ")})
            ORDER BY joined_at ASC`,
      args: [guildId, ...ids],
    })
    .catch(() => ({ rows: [] }));

  const membersByRecruit = new Map(ids.map((id) => [id, []]));
  for (const m of members) {
    membersByRecruit.get(Number(m.recruit_id))?.push({
      user_id:   String(m.user_id),
      username:  m.username ?? null,
      joined_at: Number(m.joined_at),
    });
  }

  const toNumberOrNull = (v) => (v == null ? null : Number(v));

  return json(
    recruits.map((r) => ({
      id:           Number(r.id),
      channel_id:   String(r.channel_id),
      message_id:   r.message_id ?? null,
      author_id:    String(r.author_id),
      author_name:  r.author_name ?? null,
      title:        r.title,
      description:  r.description ?? null,
      capacity:     toNumberOrNull(r.capacity),
      end_at:       toNumberOrNull(r.end_at),
      status:       r.status,
      close_reason: r.close_reason ?? null,
      created_at:   Number(r.created_at),
      closed_at:    toNumberOrNull(r.closed_at),
      members:      membersByRecruit.get(Number(r.id)) ?? [],
    })),
  );
}
