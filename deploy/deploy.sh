#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/homestay"
cd "$APP_DIR"

echo "[1/6] Pull latest source..."
git pull --ff-only

echo "[2/6] Install backend dependencies..."
npm install --prefix backend

echo "[3/6] Install frontend dependencies..."
npm install --prefix frontend

echo "[4/6] Build frontend..."
npm run build --prefix frontend

echo "[5/6] Reload backend with PM2..."
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save

echo "[6/6] Reload Nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "Deploy finished successfully."
