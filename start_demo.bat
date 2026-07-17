@echo off
echo ===================================================
echo     Starting BAFT (Audio Forensics Toolkit)
echo ===================================================

:: Start the FastAPI Backend in a new window
echo Starting Backend Server...
start "BAFT Backend" cmd /k "cd backend && call .\venv\Scripts\activate.bat && python main.py"

:: Wait 3 seconds for the backend to initialize
timeout /t 3 /nobreak > nul

:: Start the React Frontend in a new window
echo Starting Frontend Server...
start "BAFT Frontend" cmd /k "cd frontend && npm run dev"

:: Wait 2 seconds for Vite to start
timeout /t 2 /nobreak > nul

:: Open the web app in the default browser
echo Opening BAFT Dashboard in your browser...
start http://localhost:5173

echo ===================================================
echo   Servers are running! Close the black terminal
echo   windows when you are finished to stop them.
echo ===================================================
pause
