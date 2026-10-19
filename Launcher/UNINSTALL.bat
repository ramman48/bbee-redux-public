@echo off
title The Zenith Terminal - safe uninstall (cleans your save first)
cd /d "%~dp0"
set "PYTHON_EXE="
if exist "%~dp0..\Interpreter\pythoncore-3.14-64\python.exe" set "PYTHON_EXE=%~dp0..\Interpreter\pythoncore-3.14-64\python.exe"
if not defined PYTHON_EXE if exist "%~dp0..\Interpreter\bin\python.exe" set "PYTHON_EXE=%~dp0..\Interpreter\bin\python.exe"
if defined PYTHON_EXE (
    "%PYTHON_EXE%" entry_point.py uninstall
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (py -3 entry_point.py uninstall) else (python entry_point.py uninstall)
)
echo.
pause
