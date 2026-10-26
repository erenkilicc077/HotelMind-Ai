@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo HotelMind AI v0.2 - Baslatiliyor...
if exist ".venv\Scripts\python.exe" goto check_setup
py -3.12 -m venv .venv
if errorlevel 1 goto no_python
:check_setup
if not exist ".venv\hotelmind_v02_ready" goto install
.venv\Scripts\python.exe -c "import hotelmind, fastapi, uvicorn, sklearn, xgboost, shap" >nul 2>nul
if errorlevel 1 goto install
goto model
:install
echo Ilk kurulum: gerekli paketler yukleniyor. Bu islem internet gerektirir.
.venv\Scripts\python.exe -m pip install -r requirements-tested.txt
if errorlevel 1 goto failed
.venv\Scripts\python.exe -m pip install -e ".[dev]" -c requirements-tested.txt
if errorlevel 1 goto failed
echo 0.2.0> .venv\hotelmind_v02_ready
:model
if exist "models\cancellation_pipeline.joblib" goto launch
if not exist "data\raw\hotel_bookings.csv" (
  .venv\Scripts\python.exe scripts\download_data.py
  if errorlevel 1 goto failed
)
.venv\Scripts\python.exe scripts\train.py --data data\raw\hotel_bookings.csv
if errorlevel 1 goto failed
.venv\Scripts\python.exe scripts\export_dashboard.py
if errorlevel 1 goto failed
:launch
.venv\Scripts\python.exe -m hotelmind.launcher
if errorlevel 1 goto failed
exit /b 0
:no_python
echo Python 3.12 bulunamadi. Terminalde py install 3.12 komutunu calistirip tekrar deneyin.
pause
exit /b 1
:failed
echo Islem tamamlanamadi. Yukaridaki hata mesajini kontrol edin.
pause
exit /b 1
