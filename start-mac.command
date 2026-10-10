#!/bin/bash
# 더블클릭으로 Atlas 실행 (macOS)
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
  read -r -p "Enter를 누르면 창이 닫힙니다."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "처음 실행: 필요한 파일을 설치합니다 (1~2분)..."
  npm install || { read -r -p "설치 실패. Enter를 누르면 닫힙니다."; exit 1; }
fi
echo "Atlas를 실행합니다. 브라우저가 자동으로 열립니다. 종료하려면 이 창을 닫으세요."
npm run dev -- --open
