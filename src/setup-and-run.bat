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

echo  ===============================================================
echo  =                                                            =
echo  =              CONFIGURAÇÃO DO THINKER - CHATBOT             =
echo  =                                                            =
echo  =   Para iniciar, edite o arquivo .env na raiz do projeto    =
echo  =   e adicione suas preferencias de trabalho                 =
echo  ===============================================================
echo.


:: Checa Node.js
where node >nul 2>&1 || (
  echo ERRO: Node.js não encontrado. Instale em https://nodejs.org/
  pause
  exit /b 1
)

:: Vai para a raiz do projeto
cd /d "%~dp0..\" 
echo Project directory: %CD%
echo.

:: Instala dependências
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo ERRO: falha ao instalar dependências
  pause
  exit /b 1
)

:: Inicia o bot
echo.
echo === Iniciando o WhatsApp Bot ===
call npm start
if %ERRORLEVEL% NEQ 0 (
  echo ERRO: aplicação caiu
  pause
)

pause
endlocal
exit /b 0