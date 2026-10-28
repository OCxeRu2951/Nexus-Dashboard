# Nexus Dashboard

> Web-based management dashboard for [Nexus Bot](https://github.com/OCxeRu2951/DiscordBot-Nexus)

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-f07830?logo=cloudflare&logoColor=white)](https://nexus-dashboard-4nu.pages.dev)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)

[日本語のREADMEはこちら](./README/ja-README.md)

---

## Overview

Nexus Dashboard is the web interface for configuring [Nexus Bot](https://github.com/OCxeRu2951/DiscordBot-Nexus). It allows server administrators to manage bot settings, moderation logs, hourly announcements, and application systems without using Discord commands.

## Features

- **Authentication** — Discord OAuth2 login with two access levels: admins (Manage Server) get every page; other members get the Recruitment page only (limited to viewer roles if configured)
- **Server Selection** — Lists servers where Nexus is installed and the user is an admin or an allowed member
- **General Settings** — Configure AFK timeout, data retention periods
- **Hourly Announcements** — Set messages per hour and day of week, with embed/image/file support
- **Moderation** — Configure log channels and warning thresholds
- **Application System** — View and manage applications submitted via `a!`
- **Recruitment** — Open and closed recruitment posts (`/recruit`, `b!`) with host, channel, deadline, members and thread links. Members see posts in channels they can view in Discord and can close their own; admins can close any post and edit the list channel, thread / forum mode and viewer roles. Closing is queued and executed by the bot
- **Dark / Light Mode** — System preference detection with manual toggle
- **Multilingual** — Japanese and English

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite |
| Styling | CSS Modules |
| i18n | i18next |
| API / Functions | Cloudflare Pages Functions |
| Auth | Discord OAuth2 + Cloudflare KV (sessions) |
| Database | Turso (libSQL) |
| Hosting | Cloudflare Pages |

## Project Structure

```dir
nexus-dashboard/
├── src/
│   ├── pages/          # Login, Servers, Dashboard, General, Hourly, Moderation, Apply, Recruit
│   ├── components/     # Sidebar, DashboardLayout, ChannelSelect, NexusIcon
│   ├── hooks/          # useAuth
│   ├── i18n/           # ja.json, en.json
│   └── lib/            # api.js (Axios instance)
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

## Development

### Prerequisites

- Node.js 24.22.1+ (or 22.23.4+)
- Wrangler CLI (`npm i -g wrangler`)
- Cloudflare account
- Turso database
- Discord application with OAuth2

### Setup

```bash
git clone https://github.com/OCxeRu2951/Nexus-Dashboard.git
cd nexus-dashboard
npm install
```

Create `.dev.vars` in the project root:

```env
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_token
DASHBOARD_URL=http://localhost:8788
```

Create a KV namespace for sessions:

```bash
wrangler kv namespace create SESSIONS
```

Add the KV namespace ID to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your_kv_namespace_id"
```

### Run locally

```bash
npm run build
npm run dev:full
```

Open `http://localhost:8788`

### Deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name=nexus-dashboard --branch=main
```

## Environment Variables

| Name | Description |
| --- | --- |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord application client secret |
| `DISCORD_BOT_TOKEN` | Nexus Bot token |
| `TURSO_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `DASHBOARD_URL` | Base URL of this dashboard |

## Related

- [Nexus Bot](https://github.com/OCxeRu2951/DiscordBot-Nexus) — The Discord bot itself
- [Nexus Pages](https://github.com/OCxeRu2951/Nexus-Pages) — Public info pages (terms, privacy, status)

## License

[AGPL-3.0](./LICENSE) © 2026 OCxeRu2951
