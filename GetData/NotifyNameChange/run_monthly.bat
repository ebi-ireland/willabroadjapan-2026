@echo off
REM =====================================================
REM run_monthly.bat
REM Windowsタスクスケジューラから毎月1日に自動実行される
REM ログは同フォルダの logs\YYYY-MM.log に保存される
REM =====================================================

setlocal

REM スクリプトのあるフォルダに移動
cd /d "%~dp0"

REM ログフォルダ作成（なければ）
if not exist logs mkdir logs

REM 今月のログファイル名（例: 2026-03.log）
for /f "tokens=1-2 delims=-" %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM"') do (
    set LOGDATE=%%a-%%b
)
set LOGFILE=%~dp0logs\%LOGDATE%.log

REM 実行開始をログに記録
echo. >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"
powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'" >> "%LOGFILE%"
echo [START] colleNameChange.py >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"

REM Pythonスクリプト実行（stdout + stderr をログへ）
"C:\Users\user\AppData\Local\Python\pythoncore-3.14-64\python.exe" "%~dp0colleNameChange.py" >> "%LOGFILE%" 2>&1

REM 終了コードをログに記録
echo. >> "%LOGFILE%"
echo [END] ExitCode=%ERRORLEVEL% >> "%LOGFILE%"
powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'" >> "%LOGFILE%"

endlocal
