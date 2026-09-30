import { getSession, json, unauthorized } from "../_utils/session.js";
import { getDb } from "../_utils/db.js";
import {
  getUserGuilds,
  isAdminGuild,
  parseRoleIds,
  fetchMemberRoleIds,
} from "../_utils/access.js";

// サーバー一覧
//   Nexus が導入されていて、自分が参加しているサーバーを返す。
//   access: "admin"  = サーバー管理権限あり（全ページ）
//           "member" = 募集ページのみ（閲覧ロールが設定されている場合は該当ロール保持者のみ）
export async function onRequest(ctx) {
  const { request, env } = ctx;
  const session = await getSession(request, env);
  if (!session) return unauthorized();

  const allGuilds = await getUserGuilds(session, env);
  if (!allGuilds) return json({ error: "Failed to fetch guilds" }, 500);
  if (allGuilds.length === 0) return json([]);

  // BotがインストールされているギルドをDBで確認
  const db = getDb(env);
  const { rows } = await db
    .execute({
      sql: `SELECT guild_id FROM settings WHERE guild_id IN (${allGuilds.map(() => "?").join(",")})`,
      args: allGuilds.map((g) => g.id),
    })
    .catch(() => ({ rows: [] }));

  const botGuildIds = new Set(rows.map((r) => r.guild_id));
  const botGuilds = allGuilds.filter((g) => botGuildIds.has(g.id));

  const adminGuilds  = botGuilds.filter((g) => isAdminGuild(g));
  const memberGuilds = botGuilds.filter((g) => !isAdminGuild(g));

  // 閲覧ロールが設定されているサーバーだけ、自分のロールを確認する
  let restricted = new Map();
  if (memberGuilds.length > 0) {
    const { rows: settingRows } = await db
      .execute({
        sql: `SELECT guild_id, viewer_role_ids FROM recruit_settings
              WHERE guild_id IN (${memberGuilds.map(() => "?").join(",")})`,
        args: memberGuilds.map((g) => g.id),
      })
      .catch(() => ({ rows: [] }));
    restricted = new Map(
      settingRows
        .map((r) => [r.guild_id, parseRoleIds(r.viewer_role_ids)])
        .filter(([, ids]) => ids.length > 0),
    );
  }

  const visibleMemberGuilds = (
    await Promise.all(
      memberGuilds.map(async (g) => {
        const viewerRoleIds = restricted.get(g.id);
        if (!viewerRoleIds) return g;
        const myRoles = await fetchMemberRoleIds(env, g.id, String(session.user.id)).catch(() => null);
        return myRoles?.some((id) => viewerRoleIds.includes(id)) ? g : null;
      }),
    )
  ).filter(Boolean);

  // メンバー数は管理対象のサーバーのみ取得（Discord APIへの問い合わせ回数を抑えるため）
  const adminWithCount = await Promise.all(
    adminGuilds.map(async (g) => {
      const res = await fetch(
        `https://discord.com/api/guilds/${g.id}?with_counts=true`,
        { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } },
      );
      if (!res.ok) return { ...g, access: "admin" };
      const detail = await res.json();
      return {
        ...g,
        access: "admin",
        approximate_member_count: detail.approximate_member_count,
      };
    }),
  );

  return json([
    ...adminWithCount,
    ...visibleMemberGuilds.map((g) => ({ ...g, access: "member" })),
  ]);
}
