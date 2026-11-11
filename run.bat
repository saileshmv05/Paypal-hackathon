@echo off
title ClearSettle - AI-Assisted Group Expense Reconciliation Platform
color 0B
echo ======================================================================
echo           ClearSettle - Group Expense Reconciliation Platform
echo        "Know what your group owes. See what payments actually cost."
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] Initializing database and trip data...
call npm run seed
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database initialization failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Opening ClearSettle in your default web browser...
start "" http://localhost:5000

echo.
echo [3/3] ClearSettle server is now running at http://localhost:5000
echo ======================================================================
echo  Press Ctrl+C in this window whenever you want to shut down the server.
echo ======================================================================
echo.
call npm run server
pause
