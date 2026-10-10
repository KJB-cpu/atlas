@echo off
chcp 65001 >nul
rem 더블클릭으로 Atlas 실행 (Windows)
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
if not exist node_modules (
  echo 처음 실행: 필요한 파일을 설치합니다 [1~2분]...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
echo Atlas를 실행합니다. 브라우저가 자동으로 열립니다. 종료하려면 이 창을 닫으세요.
call npm run dev -- --open
