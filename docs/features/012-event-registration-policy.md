---
독자: 에이전트
---

# 012 상태 규칙을 한 곳에: 행사와 신청

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `logical-model.md`, 동작은 코드가 원문이다(DEC-77).

상한: 6시간(실제로 도는 시간). 시작 2026-10-24 23:46. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/012-조각번호`, 진행 기록은 `.superpowers/sdd/012/progress.md`. 근거 조사는 `vada-hq/notes/structure-audit/gap1-state.md`(N목록), `gap5-tests.md`(구조 검사 A)다.

## 왜

화면이 주는 버튼(서버 응답의 `actions`)과 서버가 받는 쓰기가 따로 적혀 있어 서로 어긋난다. 회장단은 예정 행사에서 [완료]를 보고 눌러 409를 받고, 완료한 행사에서는 신청자 명단이 사라지고, 마감 양식에 [멈추기], 출석한 신청자에 [신청 취소], 완료한 행사에 [환불함]이 보인다. 회장도 남이 만든 행사를 고치지 못한다. 이 기능은 행사와 신청의 상태 규칙을 기록 종류마다 한 파일에 두고, 읽기의 `actions`와 쓰기의 거절이 같은 판정에서 나오게 하며, 그것을 구조 검사로 지킨다.

- 근거: DEC-79(회장단도 행사를 고치고, 끝난 행사만 완료), DEC-80(완료·완료 취소 사유는 상태 옆에), DEC-38(서버가 할 수 있는 동작을 준다), DEC-68·RULE-11(완료한 행사의 기록은 바꾸지 않는다), RULE-36(공개한 기간), RULE-13(참가비 수입), RULE-22(신청자 열람 기록), work-method '검사와 시험'의 구조 검사 층, gap1 N1·N4·N9·N10·N12·N14와 '알려짐 3'(예정 행사의 완료, 남은 것 0이면 `settled`), gap5의 안 쓰는 동작 `event.set_owner`.
- 이미 있는 것(본보기): `purchases/status.ts`(`canCancel`을 읽기 `actionsOf`와 쓰기가 같이 씀), `closing/gates.ts`(막는 첫 코드를 쓰기와 읽기가 같이 씀). 잠금: `events/completion.ts`(`assertEventsOpen`, `lockEventForCompletion`), `closing/lock.ts`(`assertPeriodOpen`), `incomes/lock.ts`(둘 다 걸리면 `EVENT_COMPLETED` 먼저). 완료: `settlement/complete.ts`, `fee-income.ts`. 상태: `events/status.ts`(`eventStatusOf`), `registrations/state.ts`(`registrationStatusOf`), `public-form.ts`(완료면 `closed`). 신청자 쓰기: `staff-registration.ts`(`lockedRegistration`), `cancel-by-staff.ts`(출석 뒤 `CHECKED_IN`), `deposits/service.ts`.

### 원칙 대조

- 새로 하는 입력: 없다. 바뀌는 것은 버튼이 보이는 조건과 막힌 이유뿐이라, 누르고 거절당하는 수고가 준다(PRIN-1).
- 근거 연결: 바뀌지 않는다.
- 변경 이력: 완료·완료 취소는 지금처럼 결재 기록으로 사유와 남고, 이제 상태 옆에 보인다(DEC-80). 회장단이 고친 행사도 판에 바꾼 사람으로 남는다.
- PRIN-5: 완료 뒤에도 신청자 열람은 지금 열람 권한자에게만, 열 때마다 열람 기록(RULE-22).

## 범위 밖

- 지출·예산·구매·수입의 정책(기능 014): N2, N5~N7, 행사 화면의 [구매 요청 내기]·[예산 항목 더하기]·[지출 적기](`EventMoneyAdd.tsx`가 `status`로 가름), 지출·업무의 행사 고르기에서 완료 행사 거르기(`finance/EventField.tsx`, `ExpenseUpdateDialog.tsx`). 이 기능의 공통 잠금을 014가 쓴다.
- 업무(기능 015): N3, 업무 상태 전이, 완료 행사 업무. 주소(기능 016). N8(닫은 계좌), N13(의도됨), 개요 '업무 만들기' 권한.
- DEC-80의 나머지: 상세의 이력을 '⋯' [이력 보기]로 옮기기. 행사의 책임자 칸과 책임자 맥락(다른 권한)은 그대로 둔다.
- 화면 규칙 린트(웹이 `status`로 동작을 가르는 것을 기계로 막기). 이번에는 구조 검사와 검토로 본다.

## 정한 것

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 판정의 자리 | 기록 종류마다 `<도메인>/policy.ts` 하나. `factsOf`(판정에 드는 사실을 한 번 읽음) + 순수 `decide(actor, facts, 동작)` → 허용 또는 막는 첫 코드(권한 403 → 상태 409 순서). 읽기는 `actionsOf`·`blockersOf`, 쓰기는 잠금 뒤 거래 안에서 `factsOf` → `decide` → 던짐. 이번은 `events/policy.ts`, `registrations/policy.ts`. 규칙 문장은 logical-model RULE이 원문이고 정책 주석에 RULE 번호를 단다 | [Pundit](https://github.com/varvet/pundit)(같은 policy를 컨트롤러 `authorize`와 화면 `policy(x).update?`가 씀), `purchases/status.ts`, `closing/gates.ts` | 쉽다(코드 구조) |
| 공통 잠금 | `apps/api/src/policy/locks.ts` 한 곳에 행사 완료(RULE-11)와 기간 공개(RULE-36)의 사실 읽기(행사 행 `FOR SHARE`, 완료는 `FOR NO KEY UPDATE`)와 순수 판정. 둘 다면 `EVENT_COMPLETED`. `assertEventsOpen`·`assertEventOpen`·`assertPeriodOpen`·`lockedCompleted`는 이 파일로 옮기고 이름은 그대로 내보내(지출·수입 호출부는 014까지 그대로) 같은 규칙이 두 곳에 없게 한다 | RULE-11, RULE-36, `incomes/lock.ts`, 자주 잡힌 것 9·12 | 쉽다 |
| 동작 이름 | 화면이 누르는 일 하나에 이름 하나. 권한 키(누가, DEC-28)와 따로 두고 정책이 동작 → 권한 키 + 상태 조건으로 잇는다. 계약 동작 목록은 `Action`에 묶지 않는다. 행사 `EVENT_ACTIONS`: `event.update`, `event.complete`, `event.cancel_completion`. 양식 목록: `form.create`. 양식: `form.update`, `form.pause`, `form.resume`, `form.check_in`(QR 출석), `form.view_applicants`. 신청자 한 줄(`Applicant.actions`): `registration.check_in`, `registration.cancel_check_in`, `registration.cancel`, `deposit.confirm`, `deposit.cancel`, `deposit.refund` | [Stripe 청구서: finalize·void가 따로](https://docs.stripe.com/api/invoices/void), DEC-38 | 쉽다(화면과 같이 바뀌는 내부 API) |
| 막힘 보이기 | 역할이 없으면 숨긴다. 역할은 있는데 상태가 막으면 행사는 `EventDetail.blockers`(동작 → 그 쓰기가 낼 코드)를 주고, 화면은 완료·완료 취소 자리에만 버튼 대신 그 문구 한 줄을 보인다. 양식·신청자의 막힌 동작은 숨긴다(그 줄의 상태 칩이 이유다) | [Smashing, Hidden vs. Disabled](https://smashingmagazine.com/2024/05/hidden-vs-disabled-ux/)(쓸 수 없으면 숨기고, 잠시 막혔으면 이유와 푸는 법), `closing/gates.ts`의 blocker | 쉽다 |
| 완료 조건(DEC-79) | 회장단, 완료 안 함, `eventStatusOf`가 `ended`, 정산 남은 것 0, 참가비 수입 받을 날마다 회계 기간이 있고 공개 안 됨. 순서 `FORBIDDEN` → `EVENT_COMPLETED` → `EVENT_NOT_ENDED`(새, `EVENT_NOT_STARTED`를 뺀다) → `SETTLEMENT_PENDING` → `NO_FISCAL_PERIOD` → `PERIOD_CLOSED`. 끝 시각이 없으면 시작한 날(한국) 23:59:59까지 진행 중이다: 상태 표시·홈·개요의 '끝남'과 한 규칙으로 둔다. 판정과 수입 만들기가 `fee-income.ts`의 같은 계획(계좌마다 받은 날·기간)을 쓴다 | DEC-79, RULE-13, RULE-36, `events/status.ts` | 쉽다 |
| 막힘 목록(`blockers`) | 사람이 풀 수 있는 막힘만 싣는다: 완료는 `EVENT_NOT_ENDED`, `SETTLEMENT_PENDING`, `NO_FISCAL_PERIOD`, `PERIOD_CLOSED`, 완료 취소는 `PERIOD_CLOSED`. 이미 완료함·완료 안 함은 상태가 보여 주므로 싣지 않는다(조각 1 Ruling) | 검토 1 Minor 4 | 쉽다 |
| 기간 잠금 함수 | 부르는 곳이 없어진 `assertPeriodOpen`은 지운다. 기간 잠금은 `policy/locks.ts`의 판정 하나로 본다(조각 1 Ruling) | knip | 쉽다 |
| 완료 취소 | `event.cancel_completion`: 회장단, 완료함, 그 행사 참가비 수입이 든 기간이 공개 안 됨. `FORBIDDEN` → `EVENT_NOT_COMPLETED` → `PERIOD_CLOSED`. 경로(`POST .../complete`, `.../cancel-completion`)와 사유 규칙은 그대로 | RULE-36, DEC-68 | 쉽다 |
| 행사 고치기(DEC-79) | 권한표 `event.update`를 회장단 + 행사 책임자로. 완료한 행사는 `EVENT_COMPLETED`. 책임자 정하기(`POST /events/:id/owner`, `SetEventOwnerSchema`, 권한 키 `event.set_owner`)는 뺀다: DEC-79가 정하는 화면을 두지 않고, 화면이 안 쓰는 유일한 동작이다. 책임자 칸은 남는다 | DEC-79, gap5 | 쉽다(칸은 그대로, 경로만) |
| 정산 끝(`settled`) | 끝났거나 완료한 행사이고 남은 것이 0일 때만 참. 정산 응답(`settlement/queries.ts`)과 홈(`home/settling.ts`)이 한 도우미를 쓴다 | 알려짐 3, 자주 잡힌 것 9 | 쉽다 |
| 완료 사유(DEC-80) | 행사 상단 상태 배지 옆에 마지막 완료·완료 취소 결재(`approvals`의 마지막)의 이름(완료/완료 취소)·날짜·사람·사유. 결재가 없으면 없다 | DEC-80 | 쉽다 |
| 신청 읽기와 쓰기(N1) | 완료는 쓰기만 잠근다. `form.view_applicants`와 신청자 목록 읽기는 완료 뒤에도 열람 권한자에게 남고 열람 기록도 남는다 | RULE-11('바꾸지 않는다'), [QuickBooks 장부 마감: 거래는 보이고 고치지 못함](https://quickbooks.intuit.com/learn-support/en-us/customer-company-settings/how-to-close-the-books/00/186384), RULE-22 | 쉽다 |
| 양식 상태(N14, N9) | 운영진·공개·신청이 한 함수로 양식 상태를 센다(완료한 행사면 `closed`). 마감 지난 양식은 `form.pause`·`form.resume`이 없고 서버는 409 `FORM_CLOSED`(새). `form.update`는 마감 뒤에도 된다(마감을 늘려 다시 받는다) | `public-form.ts`, RULE-27 | 쉽다 |
| 신청자 한 줄(N10, N12) | 출석한 신청은 `registration.cancel` 대신 `registration.cancel_check_in`만(서버 `CHECKED_IN` 그대로). `deposit.refund`는 재정부·환불 대기·완료 안 함일 때만. 화면의 `canRefund`(권한 목록으로 가름)를 없앤다. 완료한 행사의 신청자 동작은 비어 있다 | `cancel-by-staff.ts`, `refund-pending.ts`, RULE-11 | 쉽다 |
| 오류 문구(N4) | 완료·완료 취소 문구에 `PERIOD_CLOSED`, `EVENT_NOT_ENDED`, 막힘 줄 문구('끝난 뒤에 완료할 수 있어요' 등), 양식에 `FORM_CLOSED`. 표에 없어 '연결 확인'이 나오던 길을 없앤다 | AGENTS.md '새 API'(코드 → 문구는 `lib/messages.ts`) | 쉽다 |
| 구조 검사 | (가) 동작 도달: 계약이 내보내는 동작 목록(`*_ACTIONS`)의 값마다 web의 시험 아닌 코드에 하나 이상 쓰인다. 건너뛰는 목록이 없다. (나) 상태표: 정책마다 상태 × 사람 × 동작 표 시험. 칸마다 읽기 `actions`에 있으면 그 쓰기가 되고, 없으면 403이나 그 칸의 코드로 거절된다(행사는 `blockers`와 같은 코드). 상태는 서비스 함수로 만들고 상태 칸을 SQL로 쓰지 않는다(시각만 `now`). 목록에 있는데 표 열에 없는 동작이 있으면 실패 | [적합도 함수](https://www.thoughtworks.com/radar/techniques/architectural-fitness-function), [표 기반 시험](https://go.dev/wiki/TableDrivenTests), work-method '검사와 시험', `boundary.test.ts`(예외 목록 없음) | 쉽다 |

## 위험

- **권한·돈·동시 처리(깊게).** 회장단 고치기는 권한표를 바꾼다. 완료 판정이 참가비 수입 계획을 같이 쓰므로 수입 금액·받은 날이 지금과 같은지 기존 `complete.test.ts`·`fee-income-day.test.ts`로 지킨다. 쓰기의 `factsOf`는 잠금을 잡은 뒤 같은 거래에서 읽는다(완료·완료 취소는 행사 행 `FOR NO KEY UPDATE`, 그 밖은 `FOR SHARE`). 읽기 `actions`는 잠그지 않는다. 조각 1·3·4는 가장 큰 모델이 검토하고, 진행 에이전트가 조각 1 배포 뒤 pg-smoke의 완료·쓰기 겹침 경우를 돌린다(`pg-smoke-event-cases.ts`의 책임자 정하기 경우는 조각 1이 뺀다).
- **계약 이름이 화면에 번진다.** 동작 이름을 바꾸는 서버 조각(1, 3, 4)은 web의 참조를 같은 조각에서 이름만 바꿔 typecheck와 web 시험을 통과시킨다(화면 동작은 2·5가 바꾼다). 계약을 바꾼 조각은 contracts·web 시험과 `ui-gallery` 스냅숏도 돌린다(011 회고).
- **시험이 옛 동작을 굳혔다.** `completion-lock.test.ts`의 '완료 뒤 양식 actions 빔'(N1), `test-support/event-fixtures.ts`의 기본 '예정 + event.complete'는 서버가 줄 수 없는 조합이라 고친다.
- **표 변경·새 의존성·비밀 값·새 라우트 모듈 없음.** 경로 하나(책임자 정하기)를 뺀다. 마이그레이션 없음.
- **vada-docs 반영(끝남, 0d03347).** 행사가 끝난 때는 logical-model '행사의 상태'(하루 단위, DEC-83), 완료와 완료 취소 조건은 RULE-42가 원문이다. 권한은 vada `permissions.ts`가 원문이고 DEC-28은 DEC-79로 일부 대체됐다.
- **메뉴 작업 폴더와 겹침.** `lib/messages.ts`, contracts `index.ts`는 공통 파일이라 필요한 줄만 고친다.

### 사람이 시작 전에 할 일

없음.

## 조각

1 → 2, 1 → 3 → 4 → 5, 마지막에 6. 2와 3은 파일이 겹치지 않아 나란히 해도 된다. 시간이 모자라면 6의 신청 상태표를 '나중'으로 넘긴다.

### 1. 공통 잠금과 행사 정책(서버) [x]
- 할 수 있게 되는 것: 행사의 고치기·완료·완료 취소를 화면에 주는 판정과 서버의 거절이 한 정책에서 나오고, 회장단이 모든 행사를 고친다.
- 수용 기준: 행사 상세 `actions`에 완료 전 행사의 `event.update`는 회장단과 책임자에게, `event.complete`는 끝났고 남은 것 0이고 수입 기간이 열린 행사에서 회장단에게, `event.cancel_completion`은 완료한 행사에서(수입 기간 공개 전) 회장단에게만 있다. `event.set_owner`는 어디에도 없고 `POST .../owner`는 404다. 회장단이 남이 만든 행사나 책임자가 떠난 행사를 고치면 200이고 판의 바꾼 사람이 회장단이다. 책임자도 회장단도 아니면 403. 예정·진행 중 행사의 완료는 409 `EVENT_NOT_ENDED`이고 끝 시각이 없는 행사는 시작한 날 23:59:59를 ±1초로 본다. 회장단이 볼 때 `blockers`의 코드는 그 쓰기가 낼 코드와 같고(예정 → `EVENT_NOT_ENDED`, 남은 것 → `SETTLEMENT_PENDING`, 기간 공개 → `PERIOD_CLOSED`), 회장단이 아니면 `blockers`가 비어 있다. 완료·완료 취소의 결과(결재, 참가비 수입, 수입 취소)는 지금과 같다. 예정·진행 중 행사의 `settled`는 남은 것이 0이어도 거짓이고 홈도 같다. 행사 완료·기간 공개 잠금의 기존 시험(`write-lock`, `locked-actions`, `completion-lock`, closing `lock`)이 그대로 통과한다. 정책의 조건 하나를 지우면 읽기 시험과 쓰기 시험이 함께 실패한다(자주 잡힌 것 11·12). 다른 학생회 행사는 404.
- 닿는 곳: contracts `events.ts`(`EVENT_ACTIONS`, `EventDetail.blockers`, `SetEventOwnerSchema` 뺌), `permissions.ts`, `errors.ts`(`EVENT_NOT_ENDED`). api `policy/locks.ts`(새), `events/policy.ts`(새), `events/completion.ts`, `events/queries.ts`, `events/service.ts`, `events/routes.ts`, `closing/lock.ts`, `settlement/complete.ts`, `settlement/fee-income.ts`, `settlement/queries.ts`, `settlement/routes.ts`, `home/settling.ts`, `access/permissions.ts`, `ops/pg-smoke/pg-smoke-event-cases.ts`. web은 이름만(`lib/messages.ts`, `test-support/event-fixtures.ts`).
- 검토: 깊게(권한, 돈, 동시 처리). 마이그레이션: 없음.

### 2. 행사 화면이 판정만 쓰기(화면) [x]
- 할 수 있게 되는 것: 회장단이 끝난 행사에서만 [완료]를, 완료한 행사에서 [완료 취소]를 보고, 막혔으면 이유를 보며, 상태 옆에서 완료 사유를 본다.
- 수용 기준: [완료]는 `event.complete`, [완료 취소]는 `event.cancel_completion`이 있을 때만 보이고, 둘 다 없고 `blockers`에 있으면 그 자리에 그 코드의 문구 한 줄이 보인다. 화면은 완료 버튼을 `status`·`settled`로 가르지 않는다(`EventCompletion.tsx`, `overview-view.ts`). 확인창이 열린 동안 다시 읽은 행사에서 그 동작이 사라지면 닫고 이유를 보인다(자주 잡힌 것 1, 지금의 `useAskingGuard`). 개요 '챙길 것'의 정산 끝 알림은 `event.complete`가 있을 때만, 예정 행사의 돈 탭에 '정산이 끝났어요'가 없다. 회장단이 남이 만든 행사에서 [고치기]로 저장한다. 완료·완료 취소가 `PERIOD_CLOSED`·`EVENT_NOT_ENDED`·`NO_FISCAL_PERIOD`로 거절되면 '연결 확인' 대신 그 문구가 버튼 옆에 보인다(N4). 상단 상태 배지 옆에 '완료 · 10월 25일 (토) · 이름'과 사유가, 완료를 취소했으면 '완료 취소 · …'와 사유가 보이고, 결재가 없으면 없다. 시험 fixture는 서버가 줄 수 있는 조합만 쓴다. 390px과 데스크톱으로 확인한다.
- 닿는 곳: web `events/EventCompletion.tsx`, `CompletionDialog.tsx`, `useCompletionPost.ts`, `overview-view.ts`, `EventHeader.tsx`, `SettlementRemaining.tsx`, `lib/messages.ts`, `test-support/event-fixtures.ts`, `ui-gallery/EventSections.tsx`.
- 검토: 보통(쓴 `components/ui` 부품의 주석 조건). 마이그레이션: 없음.

### 3. 신청 양식 정책(서버) [x]
- 할 수 있게 되는 것: 양식의 동작과 상태가 한 정책에서 나와, 완료 뒤에도 신청자를 보고 마감 양식에는 멈추기가 없다.
- 수용 기준: 완료한 행사에서 열람 권한자의 양식 `actions`에 `form.view_applicants`가 남고 신청자 목록 GET이 200이며 열람 기록이 한 줄 남는다. 쓰기 동작(`form.create`, `form.update`, `form.pause`, `form.resume`, `form.check_in`)은 없고 그 쓰기는 지금처럼 `EVENT_COMPLETED`다. 완료한 행사의 양식 상태는 운영진 응답과 공개 응답 모두 `closed`다(N14). 마감이 지난 양식은 `form.pause`·`form.resume`이 없고 멈추기·다시 받기는 409 `FORM_CLOSED`이며 판이 생기지 않는다(마감 ±1초). 마감 전에는 멈춘 양식에 `form.resume`, 아니면 `form.pause`만 있다. `form.update`는 마감 뒤에도(완료 전) 있다. 목록 `actions`의 `form.create`는 관리 권한자에게 완료 전만. 열람 권한이 없으면 목록 GET은 403. 다른 학생회 양식 404.
- 닿는 곳: contracts `registrations.ts`(양식·목록 동작 목록), `errors.ts`(`FORM_CLOSED`). api `registrations/policy.ts`(새), `queries.ts`, `state.ts`, `public-form.ts`, `apply.ts`, `service.ts`(`setPaused`), `applicants.ts`, `completion-lock.test.ts`. web은 이름만(`FormCard.tsx`, `RegistrationTab.tsx`, `events/EventOverview.tsx`).
- 검토: 깊게(신청자 개인정보 열람, 공개 신청 경로). 마이그레이션: 없음.

### 4. 신청자 한 줄 정책(서버) [x]
- 할 수 있게 되는 것: 신청자마다 할 수 있는 동작을 서버가 주고, 출석·취소·입금·환불 쓰기가 같은 판정으로 막힌다.
- 수용 기준: 신청자 목록의 줄마다 `actions`가 있다. 출석 안 한 살아 있는 신청은 `registration.check_in`·`registration.cancel`, 출석한 신청은 `registration.cancel_check_in`만(N10), 입금이 없으면 입금 확인 권한자에게 `deposit.confirm`, 확인한 입금(환불 전)이면 `deposit.cancel`, 환불 대기면 재정부에게만 `deposit.refund`(N12)다. 완료한 행사의 줄은 모두 비어 있다. 쓰기(출석, QR 출석, 출석 취소, 신청 취소, 입금 확인, 확인 취소, 환불함)는 같은 `decide`로 거절하고 코드와 순서(403 → 404 → 409)는 지금과 같다(`CHECKED_IN`, `NOT_CHECKED_IN`, `DEPOSIT_EXISTS`, `NO_DEPOSIT`, `NOT_REFUNDABLE`, `EVENT_COMPLETED`). 환불함과 확인 취소의 신청자 정보 비우기(RULE-20)는 그대로다.
- 닿는 곳: contracts `registrations.ts`(`Applicant.actions`와 목록). api `registrations/policy.ts`, `applicants.ts`, `attendance.ts`, `cancel-by-staff.ts`, `staff-registration.ts`, `deposits/service.ts`, `deposits/permission.ts`, `deposits/refund-pending.ts`. web은 이름만.
- 검토: 깊게(돈, 개인정보 비우기). 마이그레이션: 없음.

### 5. 신청 화면이 판정만 쓰기(화면) [x]
- 할 수 있게 되는 것: 운영진이 완료한 행사의 신청자를 보고, 쓸 수 없는 버튼을 보지 않는다.
- 수용 기준: 완료한 행사에서 열람 권한자가 [신청자 보기]를 누르면 명단이 버튼 없이 보인다(N1). 마감 양식에 [멈추기]·[다시 받기]가 없고 `FORM_CLOSED` 문구가 버튼 옆에 보인다(N9). 출석한 신청자에 [신청 취소]가 없다(N10). [환불함]은 그 줄의 `deposit.refund`가 있을 때만 보이고 완료한 행사에는 없다(N12). 버튼은 권한 목록(`view.permissions`)이나 `status`로 가르지 않고 `actions`만 본다. 완료한 행사의 양식 배지는 '마감'이다(N14). 확인창이 열린 동안 다시 읽은 줄에서 그 동작이 사라지면 닫고 이유를 보인다(자주 잡힌 것 1, `useDialogGuard`). 390px에서 확인한다.
- 닿는 곳: web `registrations/FormCard.tsx`, `RegistrationTab.tsx`, `ApplicantRow.tsx`, `ApplicantActions.tsx`, `DepositActions.tsx`, `registration-view.ts`, `lib/messages.ts`, `ui-gallery/RegistrationSections.tsx`.
- 검토: 보통(부품 주석 조건). 마이그레이션: 없음.

### 6. 구조 검사 [x]
- 할 수 있게 되는 것: 화면이 안 쓰는 서버 동작과, 상태마다 보이는 동작과 되는 동작의 어긋남을 CI가 잡는다.
- 수용 기준: (가) 계약이 내보내는 모든 `*_ACTIONS` 값이 web의 시험·`test-support`·`ui-gallery` 아닌 코드에 하나 이상 쓰이고, 아니면 그 이름을 적고 실패한다. 동작 하나를 화면에서 지우면 실패한다. (나) 행사 표: 상태(미정, 예정, 진행 중, 끝남·남은 것 있음, 끝남·정산 끝, 끝남·수입 기간 공개, 완료, 완료·수입 기간 공개) × 사람(회장단, 책임자, 다른 운영진) × `EVENT_ACTIONS`. 신청 표: 양식(받는 중, 멈춤, 마감, 완료)과 신청자(살아 있음, 출석, 입금 확인, 환불 대기, 완료) × 사람(관리 권한, 열람만, 재정부) × 양식·신청자 동작. 칸마다 읽기 `actions`에 있으면 그 쓰기가 성공하고, 없으면 403이나 그 칸에 적은 코드로 거절된다(행사는 `blockers`와 같은 코드). 상태는 서비스 함수로 만든다. 정책의 조건 하나를 지우면 표가 실패하고, 계약 목록에 표 열이 없는 동작을 더하면 실패한다. work-method '검사와 시험'의 구조 검사 줄에 두 시험의 자리와 "동작이나 상태를 더하면 표에 줄을 더한다"를 적는다.
- 닿는 곳: `apps/web/src/structure/actions-reach.test.ts`(새), `apps/api/src/events/policy-table.test.ts`(새), `apps/api/src/registrations/policy-table.test.ts`(새), `docs/work-method.md`.
- 검토: 보통. 마이그레이션: 없음.

## 닫기

- 지표: 2026-10-24 23:51 시작, 2026-10-25 03:28 마지막 조각을 main에(약 3시간 37분, 상한 6시간 안). 조각 6개, 깊은 검토 3번(조각 1·3·4), 보통 검토 2번(조각 2·5)이 main에 올린 뒤. 검토 지적 Critical 0, Important 4(조각 3 문서, 조각 4 0원 입금, 조각 5 화면 셈·거절 문구), 모두 고친 뒤 올림. 작업자 멈춤 1번(10분 감시로 다시 띄움). 개발 DB pg-smoke 두 번 모두 통과.
- 그대로 둘 것: 서버 쓰기는 가지 CI로 전체 시험을 돌리고, 위험한 조각은 main 전에 깊은 검토, 보통 조각은 main 뒤 검토. 메모리 7.7GB에서 시험 작업자 둘까지.
- 바꿀 것: 작업자가 서버 응답에 없는 값을 화면에서 다시 세는 일이 두 조각에서 나왔다(조각 5의 actionsWhen*, listed). 화면 조각 지시에 "서버가 주지 않는 판정은 서버 응답을 늘린다"를 넣는다.
- 다음에 시험할 것: 구조 검사(`actions-reach`, 정책 표)가 014·015에서 새 동작과 상태를 잡는지 본다.
