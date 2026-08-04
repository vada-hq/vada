# 전달 단위

`delivery-units/`는 승인된 제품 흐름과 실행 계약을 실제 구현 기준으로 연결한다.

- `implementation-architecture/draft.json`은 검토 중인 초안이며 구현 입력이 아니다.
- 전체 승인 뒤 `R<n>.json`으로 고정한 리비전만 작업 도출과 구현에 사용한다.
- 구현 기술 결정이 바뀌지 않은 후속 계약은 아키텍처 스키마 v0.2의 `base_architecture_ref`로 직전 승인 기준선을 한 번 고정하고, `decisions`에는 추가·변경된 ADR만 기록한다.
- `delivery-work/draft.json`은 승인 설계·계약·아키텍처에서 도출한 검토용 작업 그래프다. 담당자·일정·실행 상태는 넣지 않는다.
- 작업 그래프 전체 승인 뒤 `delivery-work/R<n>.json`으로 고정하고, 그 리비전만 실행 계획과 구현의 입력으로 사용한다.
- `execution-plan/draft.json`은 승인된 작업 그래프에 실행 범위·실행자·추정·목표 기간을 배치하는 검토용 계획이다. 작업 정의나 선행관계를 다시 쓰지 않는다.
- 사람이 계획 전체를 승인하면 `execution-plan/R<n>.json`으로 고정한다. 구현은 이 승인 리비전만 입력으로 사용한다.
- 실행 계획에는 `진행 중`·`완료` 같은 변하는 상태를 넣지 않는다. 실제 착수·진행·증거·차단은 별도 런타임 실행 기록에 남겨 승인 계획을 변경 불가능하게 유지한다.
- `execution-runtime/R<n>.json`은 같은 번호의 승인 실행계획을 고정 참조하는 가변 기록이다. 런타임 리비전을 원자적으로 증가시키며 과거 상태 전이와 증거를 삭제하거나 고쳐 쓰지 않는다.
- 승인 리비전은 덮어쓰지 않는다. 의미가 바뀌면 다음 리비전을 만들고 출처와 재평가 이유를 남긴다.
- 구조·참조·승인 상태는 `just validate-architecture`로 검증한다.
- 작업·증거·선행관계와 설계·계약 전체 커버리지는 `just validate-delivery-work`로 검증한다.
- 실행 계획의 작업 전수 배치, 기준선 해시, 실행자 역량, 범위·추정·일정 정책은 `just validate-execution-plan`으로 검증한다.
- 실제 상태 전이, committed 작업 전수 추적, 선행관계 기반 착수 가능성, 독립 검증 증거는 `just validate-execution-runtime`으로 검증한다.
- 현재 완료·진행·착수 가능·차단 상태는 작업 그래프와 모든 실행 런타임에서 자동 파생한다. `pnpm derive:delivery-status -- --du <DU-ID>`로 조회하고 `just validate-delivery-status`로 저장소 전체를 검증하며, 이 값을 별도 문서에 수동 복사하지 않는다.
