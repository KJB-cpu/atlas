# Atlas

개인용 근골격 해부학 웹앱 — 근육 DB(O/I/A/N, blood supply) + PT 임상 정보(MMT, special tests, dysfunction) + 3D 뷰어.

## 온라인 링크

https://claude.ai/artifact/2ZEq6ngoY266ffscEkboHJ (claude.ai Artifact, 비공개 — 본인 계정으로 로그인 시 열림)

- `npm run build:artifact` → `dist-artifact/` 생성 후 Artifact로 다시 게시하면 같은 링크가 갱신됨
- 온라인 빌드는 WebAssembly 디코더 없이 양자화 모델을 쓰고, Artifact가 `.glb`를 서빙하지 않아 모델을 `.glb.json`(base64)으로 감쌈
- My notes는 각 브라우저에 따로 저장됨 (기기 간 동기화 안 됨)

## 쉬운 실행 (더블클릭)

1. [Node.js](https://nodejs.org) LTS 버전 설치 (한 번만)
2. 이 폴더에서 더블클릭
   - macOS: `start-mac.command` (처음엔 우클릭 → 열기)
   - Windows: `start-windows.bat`
3. 브라우저가 자동으로 열림 (http://localhost:5173). 종료는 터미널 창 닫기

처음 실행 때만 필요한 파일을 설치하느라 1~2분 걸립니다.

## 실행 (터미널)

```bash
npm install
npm run dev        # http://localhost:5173
npm run validate   # 데이터 무결성 검사
npm run build      # dist/ 정적 빌드
```

## 데이터

- `src/types.ts` — 근육 데이터 스키마
- `src/data/muscles/*.ts` — 부위별 근육 데이터 (해부학 용어는 영어, 임상 설명은 한국어)
- 출처 간 차이가 있는 항목은 `sourceNote`에 표시
- 분절 지배 근육은 root를 `'T7–T12'`처럼 범위로 기록 (필터에서는 개별 root로 펼쳐 검색)
- 개인 메모는 브라우저 localStorage에 저장

## 3D 모델

- `public/models/headneck.glb` — 두개골 + 오른쪽 목·저작·표정근 (근육 48)
- `public/models/upper.glb` — 오른쪽 상지 + 경추·흉추·늑골·흉골·occipital bone (근육 54)
- `public/models/trunk.glb` — 체간 근육 24 (erector spinae, transversospinalis, abdominal wall, QL, diaphragm, intercostals, pelvic floor) + 왼쪽 늑골·골반
- `public/models/lower.glb` — 오른쪽 하지 + 골반 + 요추 (근육 51, IT tract·Achilles tendon)
- 두 모델은 같은 좌표계라 한 장면에 함께 로드됨 (H&N / UE / Trunk / LE 버튼으로 부위 프레이밍)
- `tools/parts-<region>.json` — 근육 id ↔ BodyParts3D FMA ID 매핑
- 다시 만들기: `pip install trimesh fast-simplification` 후 `npm run models:build` (부위별: `models:build:headneck`, `models:build:upper`, `models:build:trunk`, `models:build:lower`)
  (STL 원본은 `tools/.cache`에 캐시, git에는 압축된 GLB만 포함)
- 뷰어 조작: 드래그 회전 · Shift+드래그(또는 우클릭 드래그) 이동 · 휠 확대 / 근육 클릭 시 선택
- 화면 이동 패드(▲▼◀▶, +/−, 누르고 있으면 연속), 3D 클릭 후 방향키 이동 · +/− 확대, 터치는 두 손가락 이동
- 모드: X-ray(근육 반투명), Focus(선택 시 나머지 반투명), Isolate(선택 근육 + 뼈만)
- 숨기기/흐리게: 3D 우클릭 = 숨기기, Alt+클릭 = 흐리게, 선택 후 H / F 또는 Hide / Fade 버튼.
  숨김·흐림 목록에서 개별/전체 복원. 상태는 브라우저에 저장됨
- 라이선스: BodyParts3D © DBCLS, CC BY-SA 2.1 JP (`public/models/LICENSE.txt`)
