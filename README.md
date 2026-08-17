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
│  └─ decisions/       # 프로젝트 전역 설계 결정 기록
├─ specs/figma/         # wireframe별 화면·옵션 출처·상태 스코프 JSON·원본 해석
└─ tests/               # 구성 요소 사이의 통합 검증
```

## 결정 기록 위치

기록은 적용 범위에 맞는 위치에 남긴다. 특정 wireframe 사례를 전역 문서에 섞지 않는다.

- 프로젝트 전역 결정(요소 유형, 구현 관례): `docs/decisions/*.md`
- wireframe 원본을 읽는 법과 화면별 특이사항(캡처 스케일, 폰트 아티팩트, 색 매핑표): `specs/figma/<wireframeKey>/interpretation.md`
- 진행 상태와 다음 단계: `docs/HANDOFF.md`

## 화면별 Figma 산출물

- `figma.raw.json`: 플러그인이 저장한 Figma REST 형식의 원본
- `figma.design.json`: 원본을 결정적 규칙으로 정규화한 구현용 디자인 문서

```powershell
node apps/spec-service/src/generate-figma-design.mjs specs/figma/<wireframeKey>/screens/<screenId>/figma.raw.json <screenId>
```

변환 결과는 원본과 같은 화면 폴더의 `figma.design.json`에 원자적으로 저장된다.

## 명세 검증

모든 명세를 JSON Schema와 교차 참조 규칙(중복 fieldKey, 선택지 출처·인자 매핑, 상태 스코프, 이동 대상 화면, design.json nodeId·자산 존재)으로 검사한다. 오류가 있으면 종료 코드 1을 반환한다.

```powershell
node apps/spec-service/src/validate-specs.mjs            # specs/figma 전체
node apps/spec-service/src/validate-specs.mjs specs/figma/vada-wireframe
```
