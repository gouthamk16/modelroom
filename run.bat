@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   ModelRoom - setup and launch
echo ============================================

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python not found on PATH. Install Python 3.11+ and retry.
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found on PATH. Install Node 20+ and retry.
  exit /b 1
)

echo.
echo [1/4] Backend virtual environment...
cd backend
if not exist .venv (
  echo       creating .venv
  python -m venv .venv
)
echo [2/4] Backend dependencies...
.venv\Scripts\python -m pip install -q --upgrade pip
.venv\Scripts\python -m pip install -q -e ".[dev]"
cd ..

echo [3/4] Frontend dependencies...
cd frontend
if not exist node_modules (
  call npm install
) else (
  echo       node_modules present, skipping install
)
cd ..

echo [4/4] Starting servers...
start "ModelRoom Backend"  cmd /k "cd /d %~dp0backend && .venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload"
start "ModelRoom Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Waiting for the app to come up...
timeout /t 5 /nobreak >nul
start "" http://localhost:5173

echo.
echo ModelRoom is running:
echo   Frontend  http://localhost:5173
echo   Backend   http://localhost:8000
echo Close the two opened terminal windows to stop it.
endlocal
