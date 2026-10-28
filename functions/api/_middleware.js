import { json } from "./_utils/session.js";

// API 共通の前処理
//   - 更新系（GET / HEAD 以外）は、このダッシュボード自身のページからのリクエストだけ受け付ける
//     （SameSite=Lax の Cookie は同じドメインの他のサブドメインからの送信を止めないため、Origin でも確認する）
//   - 本文は JSON のみ・1MB まで
//   - 応答に nosniff / no-store を付ける（public/_headers は Functions の応答には効かないため）
const SAFE_METHODS = ["GET", "HEAD"];
const BODY_MAX = 1024 * 1024;

function withApiHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function rejectUnsafeRequest(request, env) {
  if (SAFE_METHODS.includes(request.method)) return null;

  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(env.DASHBOARD_URL).origin) {
    return json({ error: "Forbidden" }, 403);
  }

  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > BODY_MAX) return json({ error: "Payload too large" }, 413);

  const hasBody = length > 0 || request.headers.has("Transfer-Encoding");
  const type = request.headers.get("Content-Type") ?? "";
  if (hasBody && !type.toLowerCase().startsWith("application/json")) {
    return json({ error: "Unsupported media type" }, 415);
  }

  return null;
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const rejected = rejectUnsafeRequest(request, env);
  return withApiHeaders(rejected ?? (await ctx.next()));
}
