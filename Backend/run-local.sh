#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Run all backend services locally against a local PostgreSQL DB.
# Usage:  ./run-local.sh
# Stop:   Ctrl+C  (kills all spawned services automatically)
# ─────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example to .env and fill in values."
  exit 1
fi

# Export every variable from .env (skip comment lines and blank lines)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── Colours ──────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}[run-local]${NC} $*"; }
warn() { echo -e "${YELLOW}[run-local]${NC} $*"; }
err()  { echo -e "${RED}[run-local]${NC} $*"; }

# ── Cleanup on exit ──────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  warn "Shutting down all services…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
  done
  log "All services stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Check PostgreSQL is reachable ────────────────────────────────
log "Checking PostgreSQL connection…"
if ! pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -q; then
  err "PostgreSQL is not reachable at ${DB_HOST:-localhost}:${DB_PORT:-5432}."
  err "Run: sudo systemctl start postgresql"
  exit 1
fi
log "PostgreSQL is up."

# ── Helper: start one service ────────────────────────────────────
start_service() {
  local name=$1
  local dir=$2
  local port=$3

  if [[ ! -d "$dir" ]]; then
    warn "Skipping $name — directory not found: $dir"
    return
  fi
  if [[ ! -f "$dir/main.go" ]]; then
    warn "Skipping $name — no main.go in $dir"
    return
  fi

  echo -e "${CYAN}[${name}]${NC} Starting on port $port…"
  (
    cd "$dir"
    PORT="$port" go run . 2>&1 | sed "s/^/$(printf "${CYAN}[${name}]${NC} ")/"
  ) &
  PIDS+=($!)
}

# ── Start each service ───────────────────────────────────────────
start_service "auth"     "$SCRIPT_DIR/services/auth"    8081
start_service "store"    "$SCRIPT_DIR/services/store"   8082
start_service "product"  "$SCRIPT_DIR/services/product" 8083
start_service "cart"     "$SCRIPT_DIR/services/cart"    8084
start_service "payment"  "$SCRIPT_DIR/services/payment" 8085
start_service "admin"    "$SCRIPT_DIR/services/admin"   8086

# Give services a moment to bind their ports before the gateway starts
sleep 2

start_service "gateway"  "$SCRIPT_DIR/gateway"          8080

log "All services started. Gateway is at http://localhost:8080"
log "Press Ctrl+C to stop everything."

# Wait for all background jobs
wait
