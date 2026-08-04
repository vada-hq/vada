# 실행 계약

`contracts/`는 코드와 직접 결합되는 VADA 계약의 실행 원본이다. 사람을 위한 결정 이유와 승인 이력은 Notion에 두고, 이 디렉터리에는 에이전트와 CI가 검증할 수 있는 현재 계약과 불변 리비전을 둔다.

현재 행사 구매 요청 제출의 승인 기준선은 `bundles/CB-FIN-001/R1.json`이다.

## 구성

- `permissions.json`, `events.json`, `governance.json`: 안정 키와 불변 리비전
- `vocabulary.json`: 역할·권한 주체의 공유 어휘
- `openapi.json`: API 계약과 권한·리비전·AC 연결
- `openapi/<CB-ID>/R<n>.json`: 승인 계약 묶음에서 결정적으로 렌더링한 생성 클라이언트 입력
- `schemas/delivery-contract-bundle.schema.json`: 최초 계약 묶음과 개별 계약 가져오기를 지원하는 0.1 구조 규격
- `schemas/delivery-contract-bundle-0.2.0.schema.json`: 승인 기준 묶음을 한 번 참조하고 변경 계약만 기록하는 0.2 구조 규격
- `bundles/<CB-ID>/draft.json`: 검토 중인 계약 묶음. 승인 전 계약은 `proposed`이며 구현 기준선이 아니다.
- `bundles/<CB-ID>/R<n>.json`: 승인된 불변 계약 묶음. 권한·데이터·도메인·API·오류·이벤트·품질 계약과 설계 귀속을 함께 고정한다.
- `fixtures/<CB-ID>/R<n>.json`: 승인 묶음 해시에 고정된 정상·실패 데이터와 API 모의 요청·응답. `body_example_ref`로 같은 JSON 값을 프론트엔드와 백엔드가 재사용한다.
- `schemas/slice.schema.json`: 슬라이스 실행 명세의 구조 규격
- `slices/*.json`: 슬라이스별 사용자 결과·계약 기준선·AC·범위·관계
- `notion.json`: 저장소 계약과 Notion 페이지의 연결, 슬라이스 명세 리비전, 현재 V2 계획·작업 DB와 레거시 DB 경계를 관리하는 동기화 원장
- `governance.json`의 `PROCESS:work_item_flow`: 작업 상태, 강한 선행관계, 비차단 참조관계와 작은 배치 병렬 협업의 실행 규칙

## 변경 흐름

1. 관련 슬라이스의 `contractBaseline`과 미결정 계약을 확인한다.
2. 의미가 바뀌면 활성 리비전을 수정하지 않고 `@R<n+1>`을 만든다.
3. Notion에 이유·소유자·변경 등급·영향을 기록하고 `notion.json`을 연결한다.
4. 코드·테스트·계약·문서 상태를 같은 변경 집합에서 갱신한다.
5. 슬라이스 의미가 바뀌면 `specRevision`과 Notion의 `명세 리비전`을 함께 올린다.
6. `pnpm test:contracts`, `pnpm validate:contracts`, `just check`를 통과시킨다.

## 새 기능 계약 흐름

1. 승인된 `product-specs/solutions/<SOLUTION-ID>/R<n>.json`을 해시로 고정한다.
2. `bundles/<CB-ID>/draft.json`에서 설계 요소를 계약 또는 직접 작업 입력에 빠짐없이 한 번씩 귀속한다.
3. 계약 검증 후 사람의 승인만 남으면 `review_ready`로 둔다. 이 상태는 구현 승인이 아니다.
4. 명시적 승인 후 `R1.json`을 만들고 계약 상태를 `ratified`로 고정한다. 이후 의미 변경은 새 리비전으로만 한다.
5. OpenAPI 문서는 승인된 API 계약 묶음에서 렌더링하고 `x-vada-*` 추적 정보를 유지한다.

후속 묶음이 기준 묶음 대부분을 재사용하면 계약별 `imports`를 반복하지 않는다. 0.2의 `base_bundle_ref`에 승인 기준 묶음의 경로·ID·리비전·해시를 고정하고 로컬 `contracts`에는 새 리비전만 둔다. 검증기는 상속된 확정 계약과 변경분을 합쳐 필수 계약 종류, `supersedes`, 설계 귀속을 검사한다.

기존 최상위 리비전 파일과 `slices/`는 행사 초기 기준선을 보존한다. 신규 전달 단위는 계약 묶음을 정본으로 사용하고, 기존 형식에 같은 의미를 중복 기록하지 않는다.

`review` 계약이 사용자 흐름이나 데이터 모델을 바꿀 수 있으면 해당 슬라이스는 `ready`로 올릴 수 없다.

담당자·검토자·우선순위·일정·추정은 Notion 태스크가 소유하며 슬라이스 JSON에 넣지 않는다. 전체 운영 규칙은 `docs/governance/slice-operating-model.md`를 따른다.
