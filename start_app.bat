@echo off
title Garces Fruit - Sistema Segmentacion
echo ============================================
echo   Garces Fruit - Sistema de Segmentacion
echo   Backend:  http://localhost:8100
echo   Frontend: http://localhost:3100
echo   API Docs: http://localhost:8100/api/docs
echo ============================================
echo.

:: Start backend on port 8100
echo [1/2] Iniciando Backend (FastAPI) en puerto 8100...
cd /d "%~dp0backend"
start "Backend - FastAPI 8100" cmd /k "call ..\backend\.venv\Scripts\activate.bat 2>nul & uvicorn app.main:app --reload --port 8100"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend on port 3100
echo [2/2] Iniciando Frontend (Vite) en puerto 3100...
cd /d "%~dp0frontend"
start "Frontend - Vite 3100" cmd /k "npm run dev"

echo.
echo Ambos servicios iniciados.
echo   Backend:  http://localhost:8100/api/docs
echo   Frontend: http://localhost:3100
echo.
pause
