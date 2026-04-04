#!/usr/bin/env bash
# Garces Fruit - Start both services
echo "============================================"
echo "  Garces Fruit - Sistema de Segmentacion"
echo "  Backend:  http://localhost:8100"
echo "  Frontend: http://localhost:3100"
echo "  API Docs: http://localhost:8100/api/docs"
echo "============================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend
echo "[1/2] Iniciando Backend (FastAPI) en puerto 8100..."
cd "$SCRIPT_DIR/backend"
source .venv/bin/activate 2>/dev/null
uvicorn app.main:app --reload --port 8100 &
BACKEND_PID=$!

sleep 2

# Start frontend
echo "[2/2] Iniciando Frontend (Vite) en puerto 3100..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Servicios iniciados (PIDs: backend=$BACKEND_PID, frontend=$FRONTEND_PID)"
echo "Presiona Ctrl+C para detener ambos."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
