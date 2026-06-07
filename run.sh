#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  ModelRoom - setup and launch"
echo "============================================"

command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[ERROR] node not found"; exit 1; }

echo "[1/4] Backend virtual environment..."
cd backend
[ -d .venv ] || python3 -m venv .venv
echo "[2/4] Backend dependencies..."
./.venv/bin/python -m pip install -q --upgrade pip
./.venv/bin/python -m pip install -q -e ".[dev]"
cd ..

echo "[3/4] Frontend dependencies..."
cd frontend
[ -d node_modules ] || npm install
cd ..

echo "[4/4] Starting servers (Ctrl+C to stop)..."
cleanup() { kill 0; }
trap cleanup EXIT INT TERM

( cd backend && ./.venv/bin/python -m uvicorn app.main:app --port 8000 --reload ) &
( cd frontend && npm run dev ) &

sleep 5
echo ""
echo "ModelRoom is running:"
echo "  Frontend  http://localhost:5173"
echo "  Backend   http://localhost:8000"
wait
