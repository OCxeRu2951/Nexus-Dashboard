import { json, unauthorized } from "../../_utils/session.js";
import { resolveGuildAccess } from "../../_utils/access.js";

// サーバー情報（管理者・メンバー共通）
// access: "admin" = 全ページ / "member" = 募集ページのみ
export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const access = await resolveGuildAccess(request, env, params.guildId);
  if (!access) return unauthorized();
  if (access.access === "none") return json({ error: "Forbidden", access: "none" }, 403);

  const { guildId } = params;

  const guildRes = await fetch(`https://discord.com/api/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });

  if (!guildRes.ok) return json({ error: "Guild not found" }, 404);
  const guild = await guildRes.json();

  return json({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    member_count: guild.approximate_member_count,
    access: access.access,
    can_manage_messages: access.canManageMessages,
  });
}
