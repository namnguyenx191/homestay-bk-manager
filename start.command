#!/bin/zsh

set -e
setopt NO_BG_NICE

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
RUNTIME_DIR="$PROJECT_DIR/.runtime"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"
FRONTEND_PORT="5174"
BACKEND_PORT="5050"

mkdir -p "$RUNTIME_DIR"

if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
  echo "Khong tim thay thu muc backend/frontend."
  exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "Thieu backend/.env. Tao tu backend/.env.example truoc."
  exit 1
fi

if [ ! -f "$FRONTEND_DIR/.env" ]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
  echo "Da tao frontend/.env tu .env.example"
fi

if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "Dang cai dependency backend..."
  (cd "$BACKEND_DIR" && npm install)
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Dang cai dependency frontend..."
  (cd "$FRONTEND_DIR" && npm install)
fi

if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
  echo "Backend dang chay (PID $(cat "$BACKEND_PID_FILE"))."
else
  echo "Khoi dong backend..."
  (cd "$BACKEND_DIR" && PORT="$BACKEND_PORT" npm run dev > "$BACKEND_LOG" 2>&1 & echo $! > "$BACKEND_PID_FILE")
fi

if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
  echo "Frontend dang chay (PID $(cat "$FRONTEND_PID_FILE"))."
else
  echo "Khoi dong frontend..."
  (cd "$FRONTEND_DIR" && VITE_API_URL="http://localhost:$BACKEND_PORT/api" npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort > "$FRONTEND_LOG" 2>&1 & echo $! > "$FRONTEND_PID_FILE")
fi

sleep 3
open "http://localhost:$FRONTEND_PORT" || true

echo ""
echo "Da khoi dong xong."
echo "- Frontend: http://localhost:$FRONTEND_PORT"
echo "- Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "Log file:"
echo "- $BACKEND_LOG"
echo "- $FRONTEND_LOG"
echo ""
echo "Dung stop.command de tat."
