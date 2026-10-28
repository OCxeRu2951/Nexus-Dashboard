/**
 * 入力検証（設定系 API 共通）
 * ------------------------------------------------------------
 * Bot は保存された値をそのまま使うため、保存前にここで形式・範囲・所属サーバーを確認する。
 */
import { json } from "./session.js";
import { fetchGuildChannels } from "./access.js";

export const SNOWFLAKE = /^\d{15,25}$/;

// 時報の画像・添付ファイルとして受け付けるホスト。
// Bot 側の取得制限（events/ready.js）と同じ一覧にする。変えたら i18n の hourly.urlHint も直す
export const ALLOWED_MEDIA_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];
const URL_MAX = 2048;

/**
 * 本文を JSON オブジェクトとして読む。不正な JSON・オブジェクト以外は null
 */
export async function readJsonBody(request) {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body : null;
}

/**
 * 空 → null / Discord の ID → 文字列 / 不正値 → undefined
 */
export function snowflakeOrNull(value) {
  if (value == null || value === "") return null;
  const s = String(value);
  return SNOWFLAKE.test(s) ? s : undefined;
}

/**
 * 範囲内の整数 → 数値 / それ以外 → undefined
 */
export function intInRange(value, min, max) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

/**
 * 空 → null / 指定文字数以内の文字列 → 文字列 / 不正値 → undefined
 */
export function textOrNull(value, max) {
  if (value == null || value === "") return null;
  return typeof value === "string" && value.length <= max ? value : undefined;
}

/**
 * 空 → null / 許可ホストの https URL → 文字列 / 不正値 → undefined
 * （Bot が URL を取得・表示するため、内部ネットワークなど任意の宛先を保存させない）
 */
export function mediaUrlOrNull(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > URL_MAX) return undefined;

  let url;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return undefined;
  return ALLOWED_MEDIA_HOSTS.includes(url.hostname) ? value : undefined;
}

/**
 * チャンネルがすべてこのサーバーのものか確認する。
 * Bot は保存されたチャンネルIDをサーバーを限定せずに解決する箇所があるため、
 * 他のサーバーのチャンネルを保存させない。
 * 作成直後のチャンネルも通るよう、キャッシュを使わずに一覧を取る。
 *
 * @returns {Promise<Response|null>} 問題があればエラーの Response、なければ null
 */
export async function rejectForeignChannels(env, guildId, channelIds) {
  const ids = channelIds.filter(Boolean);
  if (ids.length === 0) return null;

  const channels = await fetchGuildChannels(env, guildId, { fresh: true }).catch(() => null);
  if (!channels) return json({ error: "Failed to fetch channels" }, 502);

  const own = new Set(channels.map((c) => String(c.id)));
  return ids.every((id) => own.has(id)) ? null : json({ error: "Invalid channel" }, 400);
}
