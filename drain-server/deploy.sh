#!/usr/bin/env bash
# New-site setup on a fresh VM.
#   sudo bash deploy.sh <domain> [extra-domain ...]
# Domains must already have DNS pointing at this box.
set -euo pipefail

PRIMARY="${1:?usage: deploy.sh <domain> [extra-domain ...]}"
shift || true
EXTRA=("$@")
DOMAINS=("$PRIMARY" "${EXTRA[@]:-}")
APP=/opt/drain-server
PORT="$(grep -E '^PORT=' "$APP/.env" 2>/dev/null | cut -d= -f2 || echo 49238)"
PORT="${PORT:-49238}"
EMAIL="${CERT_EMAIL:-admin@$PRIMARY}"

echo "==> site: $PRIMARY  port: $PORT  extra: ${EXTRA[*]:-none}"

apt-get update -qq
apt-get install -y -qq curl git nginx certbot docker.io docker-compose-v2 ufw

[ -x /root/.bun/bin/bun ] || curl -fsSL https://bun.sh/install | bash

cd "$APP"
docker compose up -d
sleep 8
/root/.bun/bin/bun install
/root/.bun/bin/bunx prisma generate
/root/.bun/bin/bunx prisma migrate deploy

cat > /etc/systemd/system/drain.service <<UNIT
[Unit]
Description=Drain Server ($PRIMARY)
After=network.target docker.service
Wants=docker.service

[Service]
WorkingDirectory=$APP
EnvironmentFile=$APP/.env
ExecStart=/root/.bun/bin/bun run ./src/index.ts
Restart=always
RestartSec=3s

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable drain

NAMES="${DOMAINS[*]}"
cat > /etc/nginx/sites-available/drain-$PRIMARY <<NGINX
server {
    listen 80; listen [::]:80;
    server_name $NAMES;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl http2; listen [::]:443 ssl http2;
    server_name $NAMES;
    ssl_certificate     /etc/letsencrypt/live/$PRIMARY/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$PRIMARY/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/drain-$PRIMARY /etc/nginx/sites-enabled/drain-$PRIMARY
rm -f /etc/nginx/sites-enabled/default

systemctl stop nginx || true
CERT_ARGS=(); for d in "${DOMAINS[@]}"; do CERT_ARGS+=(-d "$d"); done
certbot certonly --standalone "${CERT_ARGS[@]}" \
  --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring
nginx -t
systemctl enable --now nginx
systemctl restart drain

ufw allow 22/tcp >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null || true

echo "==> live: https://$PRIMARY"
