#!/bin/zsh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$PROJECT_DIR/.runtime"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"

stop_pid() {
  local pid_file="$1"
  local name="$2"

  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "Da tat $name (PID $pid)."
    else
      echo "$name khong con chay."
    fi
    rm -f "$pid_file"
  else
    echo "Khong tim thay PID $name."
  fi
}

stop_pid "$BACKEND_PID_FILE" "backend"
stop_pid "$FRONTEND_PID_FILE" "frontend"
