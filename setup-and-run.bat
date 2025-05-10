@echo off
setlocal

echo.
echo.
echo.
echo.
echo.
echo.
echo  ########  ##    ##  ####  ##    ##  ##   ##  ########  ########   
echo     ##     ##    ##   ##   ###   ##  ##  ##   ##        ##     ##  
echo     ##     ##    ##   ##   ## ## ##  ## ##    ##        ##     ##  
echo     ##     ########   ##   ## ## ##  ####     ######    ########   
echo     ##     ##    ##   ##   ##  ####  ## ##    ##        ##   ##    
echo     ##     ##    ##   ##   ##   ###  ##  ##   ##        ##    ##   
echo     ##     ##    ##  ####  ##    ##  ##   ##  ########  ##     ##  
echo.
echo.
echo.
echo.
echo.
echo.
echo.
echo  ===============================================================
echo  =                                                             =
echo  =            THINKER - CHATBOT INSTALLATION SCRIPT            =
echo  =                                                             =
echo  ===============================================================
echo.

timeout /t 10

:: Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Navigate to project directory if needed
cd /d "%~dp0"
echo Project directory: %CD%
echo.

echo === Installing Dependencies ===
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo Dependencies installed successfully!
echo.

echo === Starting WhatsApp Bot ===
echo The WhatsApp QR code will appear shortly. Scan it with your phone to log in.
echo.
call npm start
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Application crashed
    pause
)

pause
exit /b 0