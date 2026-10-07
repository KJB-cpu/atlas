# Atlas

개인용 근골격 해부학 웹앱 — 근육 DB(O/I/A/N, blood supply) + PT 임상 정보(MMT, special tests, dysfunction) + 3D 뷰어.

## 실행

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
- 개인 메모는 브라우저 localStorage에 저장

## 3D 모델

- `public/models/upper.glb` — 오른쪽 상지 + 경추·흉추·늑골·흉골·occipital bone (근육 54)
- `public/models/lower.glb` — 오른쪽 하지 + 골반 + 요추 (근육 51, IT tract·Achilles tendon)
- 두 모델은 같은 좌표계라 한 장면에 함께 로드됨 (UE / LE 버튼으로 부위 프레이밍)
- `tools/parts-<region>.json` — 근육 id ↔ BodyParts3D FMA ID 매핑
- 다시 만들기: `pip install trimesh fast-simplification` 후 `npm run models:build` (부위별: `models:build:upper`, `models:build:lower`)
  (STL 원본은 `tools/.cache`에 캐시, git에는 압축된 GLB만 포함)
- 뷰어 조작: 드래그 회전 · 우클릭 드래그 이동 · 휠 확대 / 근육 클릭 시 선택
- 모드: X-ray(근육 반투명), Isolate(선택 근육 + 뼈만)
- 라이선스: BodyParts3D © DBCLS, CC BY-SA 2.1 JP (`public/models/LICENSE.txt`)
