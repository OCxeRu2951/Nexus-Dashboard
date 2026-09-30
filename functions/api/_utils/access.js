/**
 * Guild Access（ダッシュボードの2段階権限）
 * ------------------------------------------------------------
 *   admin  : サーバー管理権限（MANAGE_GUILD / ADMINISTRATOR / オーナー）。全ページ
 *   member : 上記以外のメンバー。募集ページのみ
 *            recruit_settings.viewer_role_ids が設定されている場合は、そのロールを持つ人のみ
 *   none   : サーバーに参加していない、または閲覧ロールを持っていない
 *
 * 設定系の API は従来どおり session.js の verifyGuildAccess（管理者のみ）を使う。
 * このファイルは募集ページ関連の API からのみ使う。
 */
import { getSession } from "./session.js";
import { getDb } from "./db.js";

const DISCORD_API = "https://discord.com/api/v10";

export const PERMISSIONS = {
  ADMINISTRATOR:   1n << 3n,
  MANAGE_GUILD:    1n << 5n,
  VIEW_CHANNEL:    1n << 10n,
  MANAGE_MESSAGES: 1n << 13n,
};

const CACHE_TTL_SECONDS = 120;

function has(bits, flag) {
  return (BigInt(bits ?? 0) & flag) === flag;
}

export function isAdminGuild(guild) {
  return guild?.owner === true
    || has(guild?.permissions, PERMISSIONS.ADMINISTRATOR)
    || has(guild?.permissions, PERMISSIONS.MANAGE_GUILD);
}

/**
 * ログインユーザーの参加サーバー一覧（KVに5分キャッシュ。session.js と同じキー）
 */
export async function getUserGuilds(session, env) {
  const cacheKey = `guilds_cache:${session.user.id}`;
  try {
    const cached = await env.SESSIONS.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) return null;

  const guilds = await res.json();
  await env.SESSIONS.put(cacheKey, JSON.stringify(guilds), { expirationTtl: 300 }).catch(() => {});
  return guilds;
}

/**
 * Bot トークンで Discord API を叩く。結果はエッジキャッシュに短時間保存する
 * （KV の書き込み回数を消費しないよう Cache API を使う。使えない環境では毎回取得）
 */
async function botFetchJson(env, path, { ttl = CACHE_TTL_SECONDS, notFoundAsNull = false } = {}) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`https://nexus-dashboard.cache/${path}`);

  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => null);
    if (hit) return hit.json();
  }

  const res = await fetch(`${DISCORD_API}/${path}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  if (notFoundAsNull && res.status === 404) return null;
  if (!res.ok) throw new Error(`Discord API ${path} failed: ${res.status}`);

  const data = await res.json();
  if (cache) {
    await cache
      .put(cacheKey, new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttl}` },
      }))
      .catch(() => {});
  }
  return data;
}

export async function fetchMemberRoleIds(env, guildId, userId) {
  const member = await botFetchJson(env, `guilds/${guildId}/members/${userId}`, { notFoundAsNull: true });
  return member ? (member.roles ?? []).map(String) : null;
}

export function fetchGuildRoles(env, guildId) {
  return botFetchJson(env, `guilds/${guildId}/roles`);
}

export function fetchGuildChannels(env, guildId) {
  return botFetchJson(env, `guilds/${guildId}/channels`);
}

export function parseRoleIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function getViewerRoleIds(db, guildId) {
  const { rows } = await db
    .execute({ sql: `SELECT viewer_role_ids FROM recruit_settings WHERE guild_id = ?`, args: [guildId] })
    .catch(() => ({ rows: [] }));
  return parseRoleIds(rows[0]?.viewer_role_ids);
}

/**
 * @returns {Promise<null | {
 *   session: object, userId: string, guild: object,
 *   access: "admin"|"member"|"none", canManageMessages: boolean, memberRoleIds: string[]|null
 * }>}  null = 未ログイン / 参加していないサーバー
 */
export async function resolveGuildAccess(request, env, guildId) {
  const session = await getSession(request, env);
  if (!session) return null;

  const guilds = await getUserGuilds(session, env);
  const guild  = guilds?.find((g) => g.id === guildId);
  if (!guild) return null;

  const base = { session, userId: String(session.user.id), guild, memberRoleIds: null };

  if (isAdminGuild(guild)) {
    return { ...base, access: "admin", canManageMessages: true };
  }

  const viewerRoleIds = await getViewerRoleIds(getDb(env), guildId);
  let memberRoleIds = null;

  if (viewerRoleIds.length > 0) {
    memberRoleIds = await fetchMemberRoleIds(env, guildId, base.userId).catch(() => null);
    if (!memberRoleIds || !memberRoleIds.some((id) => viewerRoleIds.includes(id))) {
      return { ...base, access: "none", canManageMessages: false };
    }
  }

  return {
    ...base,
    memberRoleIds,
    access: "member",
    canManageMessages: has(guild.permissions, PERMISSIONS.MANAGE_MESSAGES),
  };
}

function isRoleOverwrite(o)   { return o.type === 0 || o.type === "role"; }
function isMemberOverwrite(o) { return o.type === 1 || o.type === "member"; }

/**
 * Discord の権限計算に従い、メンバーが閲覧（VIEW_CHANNEL）できるチャンネルIDを求める。
 * https://discord.com/developers/docs/topics/permissions#permission-overwrites
 */
export function computeViewableChannelIds({ guildId, userId, memberRoleIds, roles, channels }) {
  const roleSet  = new Set(memberRoleIds);
  const everyone = roles.find((r) => r.id === guildId);

  let base = BigInt(everyone?.permissions ?? 0);
  for (const role of roles) {
    if (roleSet.has(role.id)) base |= BigInt(role.permissions ?? 0);
  }

  if (has(base, PERMISSIONS.ADMINISTRATOR)) return new Set(channels.map((c) => c.id));

  const viewable = new Set();
  for (const channel of channels) {
    const overwrites = channel.permission_overwrites ?? [];
    let perms = base;

    const everyoneOw = overwrites.find((o) => o.id === guildId);
    if (everyoneOw) {
      perms &= ~BigInt(everyoneOw.deny ?? 0);
      perms |= BigInt(everyoneOw.allow ?? 0);
    }

    let allow = 0n;
    let deny  = 0n;
    for (const o of overwrites) {
      if (isRoleOverwrite(o) && o.id !== guildId && roleSet.has(o.id)) {
        allow |= BigInt(o.allow ?? 0);
        deny  |= BigInt(o.deny ?? 0);
      }
    }
    perms &= ~deny;
    perms |= allow;

    const memberOw = overwrites.find((o) => isMemberOverwrite(o) && o.id === userId);
    if (memberOw) {
      perms &= ~BigInt(memberOw.deny ?? 0);
      perms |= BigInt(memberOw.allow ?? 0);
    }

    if (has(perms, PERMISSIONS.VIEW_CHANNEL)) viewable.add(channel.id);
  }
  return viewable;
}
