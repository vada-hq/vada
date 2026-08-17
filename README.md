# Figma Spec v2

Figma에서 선택한 화면을 분석하여 개발 구현에 사용할 JSON 명세를 만드는 프로젝트이다.

## 디렉터리 구조

```text
figma-spec-v2/
├─ apps/
│  ├─ figma-plugin/    # 화면 선택, Figma 구조 수집, 검토 UI
│  └─ spec-service/    # Figma 플러그인과 로컬 화면 JSON 사이의 브리지
├─ packages/
│  └─ contracts/       # JSON 형식과 검증 규칙의 유일한 원본
│     └─ schemas/      # 사람이 직접 관리하는 JSON Schema 원본
├─ docs/
│  └─ decisions/       # 확정된 설계 결정 기록
├─ specs/figma/         # wireframe별 화면·옵션 출처·상태 스코프 JSON
└─ tests/               # 구성 요소 사이의 통합 검증
```

## 화면별 Figma 산출물

- `figma.raw.json`: 플러그인이 저장한 Figma REST 형식의 원본
- `figma.design.json`: 원본을 결정적 규칙으로 정규화한 구현용 디자인 문서

```powershell
node apps/spec-service/src/generate-figma-design.mjs specs/figma/<wireframeKey>/screens/<screenId>/figma.raw.json <screenId>
```

변환 결과는 원본과 같은 화면 폴더의 `figma.design.json`에 원자적으로 저장된다.
