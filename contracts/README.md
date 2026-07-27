# 실행 계약

`contracts/`는 코드와 직접 결합되는 VADA 계약의 실행 원본이다. 사람을 위한 결정 이유와 승인 이력은 Notion에 두고, 이 디렉터리에는 에이전트와 CI가 검증할 수 있는 현재 계약과 불변 리비전을 둔다.

## 구성

- `permissions.json`, `events.json`, `governance.json`: 안정 키와 불변 리비전
- `vocabulary.json`: 역할·권한 주체의 공유 어휘
- `openapi.json`: API 계약과 권한·리비전·AC 연결
- `schemas/slice.schema.json`: 슬라이스 실행 명세의 구조 규격
- `slices/*.json`: 슬라이스별 사용자 결과·계약 기준선·AC·범위·관계
- `notion.json`: 저장소 계약과 Notion 페이지의 연결 및 슬라이스 명세 리비전 동기화 원장

## 변경 흐름

1. 관련 슬라이스의 `contractBaseline`과 미결정 계약을 확인한다.
2. 의미가 바뀌면 활성 리비전을 수정하지 않고 `@R<n+1>`을 만든다.
3. Notion에 이유·소유자·변경 등급·영향을 기록하고 `notion.json`을 연결한다.
4. 코드·테스트·계약·문서 상태를 같은 변경 집합에서 갱신한다.
5. 슬라이스 의미가 바뀌면 `specRevision`과 Notion의 `명세 리비전`을 함께 올린다.
6. `pnpm test:contracts`, `pnpm validate:contracts`, `just check`를 통과시킨다.

`review` 계약이 사용자 흐름이나 데이터 모델을 바꿀 수 있으면 해당 슬라이스는 `ready`로 올릴 수 없다.

담당자·검토자·우선순위·일정·추정은 Notion 태스크가 소유하며 슬라이스 JSON에 넣지 않는다. 전체 운영 규칙은 `docs/governance/slice-operating-model.md`를 따른다.
