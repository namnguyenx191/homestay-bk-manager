#!/bin/zsh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$PROJECT_DIR/.runtime"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_PORT="${BACKEND_PORT:-5050}"
FRONTEND_PORT="${FRONTEND_PORT:-5174}"

stop_port() {
  local port="$1"
  local label="$2"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)"
  if [ -n "$pids" ]; then
    echo "$label (port $port): dang tat PID $pids..."
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)"
    if [ -n "$pids" ]; then
      kill -9 $pids 2>/dev/null || true
    fi
    echo "Da giai phong port $port."
  fi
}

stop_pid() {
  local pid_file="$1"
  local name="$2"

  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
      echo "Da tat $name (PID $pid)."
    else
      echo "$name khong con chay (PID cu trong file)."
    fi
    rm -f "$pid_file"
  else
    echo "Khong tim thay PID file $name."
  fi
}

stop_pid "$BACKEND_PID_FILE" "backend (npm)"
stop_pid "$FRONTEND_PID_FILE" "frontend (npm)"

# npm chi la wrapper; node/vite co the con lang nghe — tat theo port cho chac.
stop_port "$BACKEND_PORT" "Backend"
stop_port "$FRONTEND_PORT" "Frontend"

echo "[Hoan tat]"
