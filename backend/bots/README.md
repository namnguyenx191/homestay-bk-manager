# MoMo Notification Bot (Email -> Booking Status)

This folder contains sample bots that read transfer notification emails and auto-confirm bookings by transfer reference.

## How it works

1. Customer books with `bank_transfer`.
2. System creates reference, e.g. `HS-AB12CD34` (or add-on `AO-...`).
3. Customer transfers money (can scan your personal QR).
4. Notification email contains that reference.
5. Bot extracts reference + amount and calls:
   - `POST /api/bookings/bot/confirm-transfer`

If valid, booking becomes `paid` + `confirmed`.

## Required backend env

Set in `backend/.env`:

```env
BOT_SYNC_TOKEN=super_secret_long_token
BOT_IMAP_HOST=imap.gmail.com
BOT_IMAP_PORT=993
BOT_EMAIL_USER=your-email@gmail.com
BOT_EMAIL_PASS=your-app-password
BOT_EMAIL_FROM_FILTER=service@momo.vn
BOT_API_BASE=http://localhost:5050/api
```

## NodeJS bot

```bash
cd backend
npm install
npm run bot:momo:node
```

## Python bot

Install deps:

```bash
pip install requests python-dotenv
```

Run:

```bash
cd backend/bots
python momo_mail_bot.py
```

## Important notes

- Personal QR is supported, but transfer content should include booking reference (`HS-...` or `AO-...`).
- Without reference in the notification text, bot cannot match order reliably.
- For production, run bot by cron/pm2 and store processed message IDs to avoid duplicates.
