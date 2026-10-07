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
