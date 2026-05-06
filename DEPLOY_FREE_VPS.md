# Deploy Free VPS (Oracle) - Homestay

This guide deploys frontend + backend on one Ubuntu VPS with Nginx + PM2.

## 1) Prepare Ubuntu VPS

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

Optional (if using local MongoDB):

```bash
sudo apt install -y mongodb
sudo systemctl enable mongodb --now
```

## 2) Clone project

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <your-repo-url> homestay
cd /var/www/homestay
```

## 3) Setup environment

```bash
cp deploy/backend.env.production.example backend/.env
cp deploy/frontend.env.production.example frontend/.env
```

Edit values:
- `backend/.env`: `MONGO_URI`, `JWT_SECRET`, payment keys, cloudinary, etc.
- `frontend/.env`: correct domain in `VITE_API_URL` and `VITE_SOCKET_URL`.

## 4) Build + run API

```bash
npm install --prefix backend
npm install --prefix frontend
npm run build --prefix frontend
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

## 5) Configure Nginx

```bash
sudo cp deploy/nginx.homestay.conf /etc/nginx/sites-available/homestay
sudo ln -sf /etc/nginx/sites-available/homestay /etc/nginx/sites-enabled/homestay
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Configure SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 7) Deploy next updates

```bash
cd /var/www/homestay
bash deploy/deploy.sh
```

## Notes

- If using Mongo Atlas, set Atlas URI in `backend/.env` and skip local Mongo install.
- If using Redis queue worker, ensure `REDIS_URL` points to a running Redis.
- Check API health: `https://your-domain.com/api/health`.
