@echo off
cd /d "%~dp0"
echo ============================================
echo   Catasto Segnaletica - Avvio Browser
echo ============================================
echo.
echo 1. Avvia LM Studio e carica il tuo modello GGUF
echo 2. In LM Studio: Local Server ^> Start Server (porta 1234)
echo.
echo Avvio server locale...

:: Avvia npm run dev in una nuova finestra
start "Catasto Segnaletica - Server" cmd /k "cd /d "%~dp0" && npm run dev"

:: Attendi che Vite sia pronto (circa 3 secondi)
timeout /t 4 /nobreak > nul

:: Apri nel browser predefinito
echo Apertura browser su http://localhost:5173
start http://localhost:5173

echo.
echo Server in esecuzione. Chiudi la finestra "Server" per spegnerlo.
