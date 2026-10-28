# Nexus Dashboard

> [Nexus Bot](https://github.com/OCxeRu2951/DiscordBot-Nexus) のWebベース管理ダッシュボード

[![Cloudflare Pages](https://img.shields.io/badge/デプロイ先-Cloudflare%20Pages-f07830?logo=cloudflare&logoColor=white)](https://nexus-dashboard-4nu.pages.dev)
[![License](https://img.shields.io/badge/ライセンス-AGPL--3.0-blue)](./LICENSE)

[Click here for the English README.](../README.md)

---

## 概要

Nexus Dashboardは [Nexus Bot](https://github.com/OCxeRu2951/DiscordBot-Nexus) の設定をWebブラウザから管理できるインターフェースです。Discordコマンドを使わずに、モデレーション設定・時報・申請システムなどをGUIで管理できます。

## 機能

- **認証** — Discord OAuth2ログイン。権限は2段階で、管理者（サーバー管理権限）は全ページ、それ以外のメンバーは募集ページのみ（閲覧ロール設定時はそのロールのみ）
- **サーバー選択** — Nexusが導入済みで、管理者または閲覧を許可されたメンバーであるサーバーを一覧表示
- **一般設定** — AFK時間・データ保持期間の設定
- **時報設定** — 時間・曜日別のメッセージ設定（Embed・画像・ファイル対応）
- **モデレーション** — ログチャンネル・警告しきい値の設定
- **申請システム** — `a!` で送信された申請の閲覧・管理
- **募集** — `/recruit`・`b!` で作成された募集の一覧（募集者・チャンネル・締切・参加者・スレッド）。メンバーはDiscordで見られるチャンネルの募集を閲覧し、自分の募集を締切可能。管理者は全件の締切と、更新リストのチャンネル・スレッド/フォーラム方式・閲覧ロールの設定が可能。締切はBotが実行
- **ダーク / ライトモード** — システム設定に応じた自動切り替え・手動切り替え
- **多言語対応** — 日本語・英語

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| フロントエンド | React 18 + Vite |
| スタイリング | CSS Modules |
| 多言語 | i18next |
| API / Functions | Cloudflare Pages Functions |
| 認証 | Discord OAuth2 + Cloudflare KV（セッション管理） |
| データベース | Turso (libSQL) |
| ホスティング | Cloudflare Pages |

## プロジェクト構成

```dir
nexus-dashboard/
├── src/
│   ├── pages/          # Login, Servers, Dashboard, General, Hourly, Moderation, Apply, Recruit
│   ├── components/     # Sidebar, DashboardLayout, ChannelSelect, NexusIcon
│   ├── hooks/          # useAuth
│   ├── i18n/           # ja.json, en.json
│   └── lib/            # api.js (Axiosインスタンス)
├── functions/
│   └── api/
│       ├── _utils/     # session.js, db.js
│       ├── auth/       # login.js, callback.js, logout.js
│       ├── guilds/     # index.js, [guildId]/*
│       └── user.js
├── public/
│   ├── favicon.svg
│   └── _redirects
├── wrangler.toml
└── package.json
```

## 開発環境のセットアップ

### 前提条件

- Node.js 24.22.1以上（22系なら22.23.4以上）
- Wrangler CLI（`npm i -g wrangler`）
- Cloudflareアカウント
- Tursoデータベース
- Discord Developer PortalでOAuth2が設定済みのアプリケーション

### セットアップ

```bash
git clone https://github.com/OCxeRu2951/Nexus-Dashboard.git
cd nexus-dashboard
npm install
```

プロジェクトルートに `.dev.vars` を作成します。

```env
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_token
DASHBOARD_URL=http://localhost:8788
```

セッション用のKV Namespaceを作成します。

```bash
wrangler kv namespace create SESSIONS
```

`wrangler.toml` にKV Namespace IDを追記します。

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your_kv_namespace_id"
```

### ローカル起動

```bash
npm run build
npm run dev:full
```

`http://localhost:8788` をブラウザで開いてください。

### デプロイ

```bash
npm run build
npx wrangler pages deploy dist --project-name=nexus-dashboard --branch=main
```

## 環境変数

| 名前 | 説明 |
| --- | --- |
| `DISCORD_CLIENT_ID` | DiscordアプリケーションのクライアントID |
| `DISCORD_CLIENT_SECRET` | Discordアプリケーションのクライアントシークレット |
| `DISCORD_BOT_TOKEN` | Nexus BotのToken |
| `TURSO_URL` | TursoデータベースのURL |
| `TURSO_AUTH_TOKEN` | Tursoの認証トークン |
| `DASHBOARD_URL` | このダッシュボードのベースURL |

## 関連リポジトリ

- [Nexus Bot](https://github.com/OCxeRu2951/DiscordBot-Nexus) — Bot本体
- [Nexus Pages](https://github.com/OCxeRu2951/Nexus-Pages) — 公開情報ページ（利用規約・プライバシーポリシー・申請確認）

## ライセンス

[AGPL-3.0](./LICENSE) © 2026 OCxeRu2951
