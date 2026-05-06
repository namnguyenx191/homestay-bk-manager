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
MONGO_PORT="27017"

mkdir -p "$RUNTIME_DIR"

wait_tcp() {
  local host="$1"
  local port="$2"
  local label="$3"
  local max="${4:-45}"
  local i=0
  echo "Cho $label (TCP $host:$port)..."
  while [ "$i" -lt "$max" ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      echo "OK: $label"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "Loi: $label khong mo duoc sau ${max}s."
  return 1
}

wait_http() {
  local url="$1"
  local label="$2"
  local max="${3:-120}"
  local log_file="$4"
  local i=0
  local dots=0
  echo "Cho $label san sang ($url)..."
  while [ "$i" -lt "$max" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "OK: $label"
      return 0
    fi
    # Moi 8 giay in vai dong log backend de biet dang treo o dau
    if [ -n "$log_file" ] && [ -f "$log_file" ] && [ $((i % 8)) -eq 0 ] && [ "$i" -gt 0 ]; then
      echo ""
      echo "--- Log backend (tail) ---"
      tail -n 12 "$log_file" 2>/dev/null | sed 's/^/  | /' || true
      echo "--------------------------"
    fi
    printf "."
    dots=$((dots + 1))
    if [ "$dots" -eq 40 ]; then
      echo ""
      dots=0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo ""
  echo "Loi: $label khong phan hoi sau ${max}s."
  if [ -n "$log_file" ] && [ -f "$log_file" ]; then
    echo "Toan bo log backend:"
    cat "$log_file"
  fi
  return 1
}

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

# Dam bao Mongo lang nghe 127.0.0.1:27017 khi MONGO_URI la localhost (mac dinh trong .env.example)
ensure_mongodb() {
  if grep -q '^MONGO_URI=mongodb+srv://' "$BACKEND_DIR/.env" 2>/dev/null; then
    echo "MONGO_URI dung Atlas (mongodb+srv) — khong khoi dong Mongo trong Docker."
    return 0
  fi

  if nc -z 127.0.0.1 "$MONGO_PORT" 2>/dev/null; then
    echo "OK: da co dich vu tren port $MONGO_PORT (Mongo da chay)."
    return 0
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo ""
    echo "Loi: Port $MONGO_PORT chua mo va khong tim thay Docker."
    echo "  - Cach 1: Cai Docker Desktop, roi chay lai start.command (se tu tao Mongo)."
    echo "  - Cach 2: brew install mongodb-community@8 && brew services start mongodb-community@8"
    echo ""
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo ""
    echo "Loi: Docker co nhung daemon khong chay. Mo ung dung Docker Desktop, doi icon het xam, roi chay lai start.command."
    exit 1
  fi

  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx 'homestay-mongo'; then
    echo "Khoi dong container homestay-mongo..."
    docker start homestay-mongo 2>/dev/null || true
  else
    echo "Chua co Mongo trong Docker — dang tao container homestay-mongo (lan dau co the tai image 2-5 phut)..."
    docker run -d --name homestay-mongo --restart unless-stopped -p "${MONGO_PORT}:27017" mongo:7 || {
      echo "docker run that bai. Neu port $MONGO_PORT da bi chuong trinh khac dung, tat Mongo do hoac doi MONGO_URI."
      exit 1
    }
  fi

  wait_tcp "127.0.0.1" "$MONGO_PORT" "MongoDB (TCP)" 90 || {
    echo "Mongo khong mo port. Xem: docker logs homestay-mongo"
    exit 1
  }

  echo "Cho MongoDB san sang (mongosh ping)..."
  local j=0
  while [ "$j" -lt 45 ]; do
    if docker exec homestay-mongo mongosh --quiet --eval "db.runCommand({ ping: 1 })" >/dev/null 2>&1; then
      echo "OK: MongoDB da san sang."
      return 0
    fi
    sleep 2
    j=$((j + 1))
  done
  echo "Mongo mo port nhung khong phan hoi. Xem: docker logs homestay-mongo"
  exit 1
}

ensure_mongodb

if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "Dang cai dependency backend..."
  (cd "$BACKEND_DIR" && npm install)
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Dang cai dependency frontend..."
  (cd "$FRONTEND_DIR" && npm install)
fi

if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Dang cai concurrently (goi npm run dev tu thu muc goc)..."
  (cd "$PROJECT_DIR" && npm install)
fi

if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
  echo "Backend dang chay (PID $(cat "$BACKEND_PID_FILE"))."
else
  echo "Khoi dong backend... (log: $BACKEND_LOG)"
  : > "$BACKEND_LOG"
  (cd "$BACKEND_DIR" && PORT="$BACKEND_PORT" npm run dev >> "$BACKEND_LOG" 2>&1 & echo $! > "$BACKEND_PID_FILE")
fi

# Lan dau load node_modules + Express co the >2 phut neu dia/iCloud cham
wait_http "http://127.0.0.1:${BACKEND_PORT}/api/health" "backend API" 240 "$BACKEND_LOG" || {
  echo ""
  echo "Backend khong len duoc. Kiem tra MongoDB va MONGO_URI trong backend/.env"
  exit 1
}

if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
  echo "Frontend dang chay (PID $(cat "$FRONTEND_PID_FILE"))."
else
  echo "Khoi dong frontend... (log: $FRONTEND_LOG)"
  : > "$FRONTEND_LOG"
  (cd "$FRONTEND_DIR" && VITE_BACKEND_PORT="$BACKEND_PORT" npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort >> "$FRONTEND_LOG" 2>&1 & echo $! > "$FRONTEND_PID_FILE")
fi

wait_http "http://127.0.0.1:${FRONTEND_PORT}/" "frontend Vite" 90 "$FRONTEND_LOG" || {
  echo ""
  echo "Frontend khong len duoc. Xem: $FRONTEND_LOG"
  exit 1
}

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
echo "Hoac mot terminal: cd \"$PROJECT_DIR\" && npm run dev"
echo "Dung stop.command de tat."
