---
독자: 에이전트
---

# 014 돈 정책

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `logical-model.md`, 동작은 코드가 원문이다(DEC-77).

상한: 6시간(실제로 도는 시간). 시작 2026-10-24 23:47(명세). 양식은 `docs/work-method.md`를 따른다. 가지는 `work/014-조각번호`, 진행 기록은 `.superpowers/sdd/014/progress.md`. 012(행사·신청 정책)의 정책 모듈 꼴과 공통 잠금 조각이 main에 오른 뒤 시작한다.

## 왜

재정부는 승인했지만 사지 않기로 한 품목을 멈출 길이 없어, 그 품목 하나가 행사 완료를 영영 막는다(DEC-73, 구조 점검 N2). A 행사 요청을 B 행사 예산 항목으로 승인할 수 있어, B를 완료하면 A의 품목을 결제하지 못하고 A도 완료하지 못한다(DEC-81, Codex 감사 2). 고르기 목록과 버튼은 화면이 따로 셈해, 완료한 행사의 예산 항목·요청이 목록에 나오고 누르면 409로 실패한다(N5, N6, N7). 닫은 계좌가 열린 신청 양식의 참가비 계좌로 남는다(N8).

이 기능은 012가 만드는 정책 모듈 꼴(`<도메인>/policy.ts`: 사실 읽기 factsOf + 순수 판정 decide, 응답의 동작·판정과 서버 쓰기가 같은 decide, 여러 기록에 걸린 잠금은 공통 한 곳)을 품목·지출·예산 항목·계좌에 넓힌다. 012와 이 명세의 이름·자리가 다르면 012를 따르고 `Ruling:`으로 남긴다.

- 근거: DEC-73(승인 품목 취소, 품목 결재는 한 방향), DEC-81·RULE-40(행사 귀속), RULE-9(되돌리지 않음, 사유), RULE-11(완료 행사 잠금 범위: 증빙, 예산 항목 고르기, 품목 결제), RULE-12, RULE-34(닫힌 계좌), RULE-36(기간 잠금은 증빙·환급·사유를 막지 않음), DEC-38(서버가 준 동작으로 버튼), logical-model '품목의 상태'(마지막 결재 기록), '행사의 정산이 끝났는가'.
- 조사: `vada-hq/notes/structure-audit/gap1-state.md`(N2, N5~N8, 대책 B·C), `codex-audit.md` 1·2번.
- 이미 있는 것: `purchases/status.ts`(`canCancel`, `actionsOf`), `purchases/decide.ts`, `expenses/status.ts`, `expenses/payable.ts`, `expenses/event-rule.ts`(직접 지출의 행사·항목 검사), `expenses/event-lock.ts`, `settlement/remaining.ts`, `events/completion.ts`(`assertEventsOpen`, 012가 공통 잠금으로 옮긴다), `closing/gates.ts`(기간 잠금), `accounts/service.ts`(`closeAccount`).

### 원칙 대조

- 새로 하는 입력: 재정부가 품목을 취소할 때 사유 한 칸. 지금은 취소할 길이 없어 행사를 완료하지 못하므로 그 자리에서 이득이다(PRIN-1). 낸 사람은 새 입력이 없다(대화로 부탁, DEC-73).
- 근거·변경 이력: 취소는 결재 기록(결과 취소, 사유, 한 사람, 시각)으로 남고 승인 기록은 그대로다(PRIN-3). 계좌 닫기를 막는 것은 기록을 바꾸지 않는다.
- 나머지(고르기 목록, 증빙 버튼, 행사 귀속 검사)는 새 입력이 없고 실패할 버튼을 없앤다.

## 범위 밖

- 행사 완료·완료 취소, 신청·입금·환불의 정책(012). 업무 정책과 RULE-41 자동 전환(015, 품목 취소 뒤 '모두 결제·반려·취소'는 조각 1의 마지막 결과 도우미를 쓴다). 재전송 중복 막기(017).
- 품목을 거친 지출에 적은 사람의 승인 기록을 남기지 않기(DEC-73 '지출의 결재', Codex 1번 셋째): 남은 일로 진행 기록에 둔다.
- 수입 정책 옮기기(`canCancelIncome`가 이미 서버·화면 한 곳). 잘린 목록을 고르기에 쓰는 문제(Codex 6번, 리허설 뒤). 낸 사람의 품목 취소 버튼(DEC-73 버린 안). 취소·반려한 품목 다시 승인(RULE-9).

## 정한 것

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 정책 꼴 | 012의 꼴을 따른다. 품목·요청은 `purchases/policy.ts`, 지출은 `expenses/policy.ts`, 예산 항목은 `budget/policy.ts`, 계좌는 `accounts/policy.ts`. decide는 허용 또는 오류 코드를 낸다. 403은 잠금 전에, 나머지는 잠근 뒤 같은 decide로 본다. 행사 완료와 기간 공개 잠금은 012의 공통 잠금만 부른다 | gap1 대책 B, 구조 점검 README '원인 1 고치는 법', [Jira 조건이 실패하면 전이 버튼이 숨는다](https://confluence.atlassian.com/display/JIRA/Advanced+workflow+configuration) | 쉽다(코드 자리) |
| 품목 취소의 기록 | 품목에 결재 기록 한 줄 더(결과 `cancelled`, 사유 필수). 승인 기록은 남는다. 품목의 상태는 마지막 결재 기록이다. `approval.outcome` CHECK에 `cancelled`를 더하는 마이그레이션 | DEC-73, DEC-29, RULE-9, logical-model 결재 기록(이미 '취소'가 있다) | 어렵다(마이그레이션, 쌓인 기록) |
| 마지막 결과 한 곳 | 품목 결재 줄이 "많아야 하나"라는 가정(`purchases/queries.ts` `decidedOn`)을 버리고, 품목의 마지막 결과를 내는 도우미 하나를 요청 상태 셈, 품목 상태, 결재 이력, 정산 남은 것(`unpaid_items`), 결제 가능(`assertPayable`), 결과 알림, 결재 시작 여부가 모두 쓴다 | 자주 잡힌 것 12, logical-model '품목의 상태' | 쉽다 |
| 취소할 수 있는 품목 | 마지막 결과가 승인이고, 취소하지 않은 결제 내역이 없고, 요청을 취소하지 않았고, 요청의 행사와 품목 예산 항목의 행사가 모두 완료 전이다. 지출을 취소해 결제가 없어지면 다시 된다. 기간 잠금은 보지 않는다(돈이 움직이지 않는다) | DEC-73, RULE-11, RULE-36 | 쉽다 |
| 권한과 경로 | `purchase.approve`(재정부, 새 권한 없음). `POST /api/organizations/:councilId/purchase-requests/:requestId/items/:lineItemId/cancel` 본문 `CancelLineItemSchema { reason: text(PURCHASE_REASON_MAX) }`. 학생회 행 → 요청 행 → 품목 행 차례로 잠근다(결재와 같은 차례) | DEC-73, RULE-4, `purchases/decide.ts` 잠금 차례 | 쉽다 |
| 요청 상태 | 대기 품목이 있으면 대기. 아니면 모두 취소면 취소, 승인(취소 안 된)이 없으면 반려, 모두 승인이면 승인, 나머지 일부 승인. 저장하지 않는다 | logical-model '요청의 상태', [줄을 모두 취소하면 주문이 취소된다(Odoo 줄 취소)](https://apps.odoo.com/apps/modules/18.0/sh_cancel_lines) | 쉽다(계산) |
| 알림 | 요청한 사람이 지금 운영진이고 취소한 사람이 아니면 알림 기록(`changed`)과 휴대폰 알림 '구매 품목이 취소됐어요'. 결재 결과 알림과 같은 길(`purchases/notify.ts`) | DEC-73 '낸 사람에게 알린다' | 쉽다 |
| 오류 코드 | 새 409 `LINE_ITEM_NOT_CANCELLABLE`(승인 아님, 이미 취소, 결제함, 요청 취소). 행사 귀속은 기존 409 `EVENT_MISMATCH`, 완료 행사는 기존 409 `EVENT_COMPLETED`. 계좌는 새 409 `ACCOUNT_IN_USE` | 기능 005·008 오류 관례, AGENTS.md 'ApiError' | 쉽다 |
| 판정 싣기 | `BudgetItemView.selectable`, `PurchaseRequestSummary.payable`, `PurchaseLineItem.payable`과 `actions`(`line_item.cancel`), `ExpenseAction`에 `expense.attach_evidence`, 계좌 동작은 `account.update`·`account.close`로 나눈다. 화면은 이 값으로만 고르기 목록과 버튼을 정하고 상태를 다시 셈하지 않는다 | gap1 대책 C, DEC-38, [GitHub GraphQL `viewerCanUpdate`](https://docs.github.com/en/graphql/reference/objects) | 쉽다(응답 칸) |
| 행사 귀속 검사 | 술어 하나(요청·지출의 행사와 예산 항목의 행사가 둘 다 있으면 같다)를 `packages/contracts`에 두고 승인(`decide.ts`), 직접 지출(`event-rule.ts`), 결재·지출 화면의 항목 고르기가 함께 쓴다. 표를 넘는 규칙이라 DB 제약은 두지 않는다 | DEC-81, RULE-40, AGENTS.md '서버와 화면이 같이 쓰면 contracts' | 쉽다 |
| 기존 불일치 | 진행 에이전트가 두 DB를 읽기로만 센다. 있으면 고치지 않고 건수와 번호를 진행 기록과 주인 보고에 적는다(결제 전이면 조각 2의 품목 취소 뒤 새 요청으로 풀 수 있다) | DEC-81 '결과', work-method 원칙 8(운영 DB 데이터는 되돌릴 수 없다) | 쉽다(바꾸지 않음) |
| 증빙 잠금 | 완료한 행사의 지출은 증빙 동작이 없다. 공개한 기간의 지출은 증빙을 막지 않는다 | RULE-11, RULE-36 | 쉽다 |
| 계좌 닫기(N8) | 완료하지 않은 행사의 신청 양식이 참가비 받는 계좌로 가리키는 계좌는 닫지 않는다(409 `ACCOUNT_IN_USE`). 카드는 [닫기] 대신 '신청 양식 N개에서 사용 중'을 보이고, 양식의 계좌를 바꾼 뒤 닫는다. 버린 안: 닫고 그 양식의 참가비 신청을 멈추기(신청자가 갑자기 막힌다), 닫고 그대로 두기(닫은 계좌로 입금받는다). 진행 에이전트가 logical-model RULE-34에 이 줄을 더한다 | [Stripe: 기본 계좌는 다른 계좌로 바꾼 뒤에야 지운다](https://docs.stripe.com/api/external_account_bank_accounts/delete), RULE-34, DEC-45 | 쉽다(막기는 풀기 쉽다) |

## 위험

- **마이그레이션(깊게).** 기존 칸의 CHECK를 넓히는 것뿐이라 위반 행이 생길 수 없다. 새 값을 쓰는 코드(조각 2)보다 먼저 두 DB에 적용한다: 조각 1에 넣고, 진행 에이전트가 개발 DB에 적용한 뒤 올리면 main CI가 운영 DB에 배포 전 적용한다. 다른 제약과 섞지 않는다. `schema.ts`와 `schema-match` 시험을 같이 본다. 표 수는 그대로다.
- **"품목마다 결재 한 줄" 가정(깊게).** 취소 줄이 생기면 승인 줄을 그대로 조인하는 읽기가 모두 틀린다(정산이 취소한 품목을 결제 전으로 세고, 취소한 품목이 결제된다, 요청 수가 두 번 센다). 조각 1이 읽는 곳을 모두 도우미로 옮기고, 승인 → 취소 품목으로 각 읽기를 시험한다(도우미를 지우면 실패, 자주 잡힌 것 11).
- **동시 처리(깊게).** 품목 취소와 그 품목을 결제하는 지출 적기가 겹치면 하나만 된다. 둘 다 학생회 행 잠금 뒤에 결제 가능·취소 가능을 읽는다. `payable.ts`의 "승인은 되돌리지 않아 이 읽기 뒤에 바뀌지 않는다" 주석은 틀리게 되므로 고친다. 조각 2를 올린 뒤 진행 에이전트가 pg-smoke에 이 경우를 더해 돌린다.
- **돈 계산(깊게).** 정산 남은 것, 결제 가능, 예산 항목별로 쓴 돈이 취소 품목을 다르게 세지 않는다. 행사 완료 조건(012)은 `remainingOf`를 그대로 쓴다.
- **012와 나란히.** 공통 잠금(`events/completion.ts` 자리)과 `expenses/event-lock.ts`를 012가 옮기면 이 기능 조각이 부딪힌다. 012의 공통 잠금 조각이 main에 오른 뒤 시작하고, 012의 다른 조각과 같은 파일을 동시에 고치지 않는다.
- **새 경로.** 기존 `purchases` 라우트 모듈에 더하므로 `boundary.test.ts`가 잡는지 본다. 새 비밀 값, 의존성, 표는 없다.
- **와이어프레임.** Figma에 품목 취소 노드가 있는지 보지 못했다. 조각 4에서 요청 상세 노드와 비교한다.

### 사람이 시작 전에 할 일

없음.

## 조각

1 → 2 → 3은 서버이고 차례로 한다(셋 다 `purchases/`). 4는 2가, 5는 1·3이 main에 오른 뒤 시작한다. 6과 7은 파일이 겹치지 않아 4·5와 나란히 해도 된다(시험 돌리는 에이전트 둘까지). 시간이 모자라면 7을 뺀다.

### 1. 품목 결재 정책과 마지막 결과 [x]
- 할 수 있게 되는 것: 품목의 상태가 마지막 결재 기록 하나로 정해지고, 요청 상태·정산·결제 가능이 같은 판정을 쓴다.
- 수용 기준: 결재 기록에 결과 `cancelled`를 넣을 수 있다(마이그레이션). 시험 도우미로 승인 → 취소한 품목을 두면, 요청 상세의 품목 상태가 `cancelled`, 결재 이력에 승인과 취소(사유)가 차례로 보이고, 요청 상태가 '정한 것'대로이며(모두 취소 → 취소, 승인+취소 → 일부 승인, 반려+취소 → 반려), 행사 정산 남은 것의 `unpaid_items`에 들지 않고, 그 품목으로 지출을 적으면 409 `LINE_ITEM_NOT_PAYABLE`, 결재하려 하면 409 `LINE_ITEM_DECIDED`다. 취소 없는 기존 시험은 그대로 통과한다. 요청의 동작(`purchase.cancel`, `purchase.approve`)은 새 `purchases/policy.ts`의 decide에서 나오고 쓰기 경로도 같은 decide를 부른다.
- 닿는 곳: `apps/api/migrations/`(새 파일), `db/schema.ts`, contracts `purchases.ts`(`LINE_ITEM_STATUSES`, `PurchaseDecision.outcome`), `purchases/status.ts` → `policy.ts`, `purchases/queries.ts`, `purchases/notify.ts`, `purchases/decide.ts`, `settlement/remaining.ts`, `expenses/payable.ts`, `test-support/purchases.ts`, 웹의 결과 문구(`finance/purchase-text.ts`).
- 검토: 깊게(마이그레이션, 돈). 마이그레이션: 있음.

### 2. 승인 품목 취소(서버) [x]
- 할 수 있게 되는 것: 재정부가 승인했고 결제하지 않은 품목을 사유와 함께 취소하고, 그 품목이 행사 완료를 막지 않는다.
- 수용 기준: 위 경로에 사유를 보내면 200이고 요청 상세가 오며 그 품목은 `cancelled`, 결재 이력에 취소·사유·나, 그 행사의 남은 것에서 빠져 다른 남은 것이 없으면 행사를 완료할 수 있다. 요청한 사람(내가 아니고 지금 운영진)에게 알림 기록과 휴대폰 알림이 간다. 대기·반려·이미 취소·결제한 품목, 취소한 요청은 409 `LINE_ITEM_NOT_CANCELLABLE`, 지출을 취소해 결제가 없어진 품목은 200. 완료한 행사(요청의 행사 또는 품목 예산 항목의 행사)면 409 `EVENT_COMPLETED`. 재정부가 아니면 403(요청한 사람·회장단 포함, 403이 먼저), 다른 요청의 품목·다른 학생회는 404, 미인증 401. 실패마다 결재 기록과 알림이 없다. 품목 응답의 `actions`에 `line_item.cancel`이 같은 decide로 실린다. 사유는 AGENTS.md의 입력 경우를 모두 시험한다.
- 닿는 곳: contracts `purchases.ts`(`CancelLineItemSchema`, `LineItemAction`), `errors.ts`, `purchases/policy.ts`, `purchases/routes.ts`, 새 `purchases/cancel-item.ts`, `purchases/notify.ts`, `http/boundary.test.ts`.
- 검토: 깊게(돈, 권한, 동시 처리). 마이그레이션: 없음.

### 3. 승인할 때 행사 귀속 검사 [x]
- 할 수 있게 되는 것: 요청과 다른 행사의 예산 항목으로는 품목을 승인할 수 없다.
- 수용 기준: 요청 행사 없음·A와 예산 항목 행사 없음·A·B를 엇갈아 승인하면 A↔B만 409 `EVENT_MISMATCH`이고 결재 기록·품목 금액이 하나도 바뀌지 않는다(한 번에 보낸 다른 품목 포함). 같은 표로 직접 지출(지출 행사 × 항목 행사)이 지금처럼 동작한다. 승인·직접 지출·화면이 contracts의 같은 술어를 쓰고, 술어를 지우면 두 서버 시험이 함께 실패한다. A 요청을 A 항목으로 승인한 뒤 다른 행사 B를 완료해도 A 품목을 결제할 수 있다. 진행 에이전트는 이 조각을 올리기 전에 개발·운영 DB에서 (a) 요청 행사와 품목 예산 항목 행사가 둘 다 있고 다른 승인 품목, (b) 지출 행사와 예산 항목 행사가 다른 취소 안 된 직접 지출을 읽기로만 세어 진행 기록에 남긴다('정한 것' 기존 불일치).
- 닿는 곳: contracts(새 술어, 파일은 `budget.ts` 근처), `purchases/decide.ts`, `purchases/policy.ts`, `expenses/event-rule.ts`.
- 검토: 깊게(돈). 마이그레이션: 없음.

### 4. 품목 취소(화면) [x]
- 할 수 있게 되는 것: 재정부가 요청 상세에서 품목을 취소하고, 모두가 취소된 품목과 사유를 본다.
- 수용 기준: `line_item.cancel`이 있는 품목에만 [품목 취소]가 있다. 누르면 사유(필수 별표) 창이 열리고 비우고 누르면 칸 아래 문제와 첫 칸 이동, 보내는 중에는 버튼을 막고, 성공하면 상세가 새로 그려져 품목 칩이 '취소됨', 결재 이력에 '취소'와 사유가 보인다. 409 `LINE_ITEM_NOT_CANCELLABLE`·`EVENT_COMPLETED` 문구가 버튼 옆에 보이고 상세를 다시 읽는다. 403·404면 닫고 이유를 보인다(자주 잡힌 것 1). 창에서 나가는 버튼은 '닫기'다. 요청 목록 칩은 서버 상태를 그대로 쓴다. 390px과 데스크톱으로 확인하고 부품 확인 화면에 취소 창과 취소된 품목이 있다.
- 닿는 곳: `apps/web/src/finance/RequestItems.tsx`, `RequestDetailDialog.tsx`, `RequestRecords.tsx`, `useRequestDetail.ts`, `purchase-text.ts`, `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통(부품 주석 조건). 마이그레이션: 없음.

### 5. 고를 수 있는 예산 항목과 요청(N6, N7) [x]
- 할 수 있게 되는 것: 결재·지출·수입의 고르기 목록에 고를 수 있는 것만 나와 고른 뒤 실패하지 않는다.
- 수용 기준: 예산 응답의 항목마다 `selectable`(완료한 행사의 항목이면 false)이, 요청 목록과 상세에 `payable`(품목마다: 마지막 결과 승인이고 요청·항목 행사가 완료 전, 요청마다: 그런 품목이 하나라도)이 실린다. 결재 창의 항목 고르기는 `selectable`이고 3의 술어로 그 요청 행사와 맞는 항목만, 직접 지출과 수입의 항목 고르기는 `selectable`만(직접 지출은 고른 행사와 술어로도), 지출의 '결제할 요청'과 품목 고르기는 `payable`만 보인다. 이미 고른 값이 고를 수 없게 되면 지금처럼 비운다. 예산 탭 목록은 그대로 모든 항목을 보인다. 서버가 같은 판정으로 거절하는지(완료 행사 항목으로 결재 409, 취소 품목 결제 409) 시험이 같은 policy를 거친다. 화면 시험은 판정이 false인 항목·요청이 목록에 없음을 본다.
- 닿는 곳: contracts `budget.ts`, `purchases.ts`, `budget/policy.ts`, `budget/queries.ts`, `purchases/queries.ts`, 웹 `finance/DecisionRow.tsx`·`DecisionPanel.tsx`·`ExpenseDirectFields.tsx`·`IncomeItemSelect.tsx`·`ExpenseRequestFields.tsx`·`budget-form.ts`.
- Ruling: 조각 3의 '화면이 같은 술어를 쓴다' 몫(결재 창 항목 고르기를 요청 행사와 맞는 항목만, 기억한 항목이 안 맞으면 비우기)은 이 조각이 한다. 조각 3은 결재 화면의 `EVENT_MISMATCH` 문구까지만 냈다.
- 검토: 보통. 마이그레이션: 없음.

### 6. 지출 정책과 증빙 붙이기(N5) [ ]
- 할 수 있게 되는 것: 완료한 행사의 지출에는 [증빙 붙이기]가 보이지 않고, 지출의 버튼과 서버 거절이 같은 판정에서 나온다.
- 수용 기준: 지출 상세의 `actions`에 `expense.attach_evidence`가 있다: 재정부, 취소 안 됨, 증빙 20장 미만, 지출의 어느 행사도 완료 전. 공개한 기간의 지출에는 있다. 완료한 행사의 지출은 증빙 버튼과 대화 사진 붙이기가 보이지 않는다. 증빙 올리기·대화 사진 증빙·취소·환급·고치기의 쓰기가 새 `expenses/policy.ts`의 같은 decide로 거절하고 코드는 지금과 같다(`EXPENSE_CANCELLED`, `EVIDENCE_LIMIT`, `EVENT_COMPLETED`, `PERIOD_CLOSED`, 403 먼저). 웹의 `canAttachEvidence` 셈은 없어진다. 판정 조건 하나를 지우면 읽기와 쓰기 시험이 함께 실패한다.
- 닿는 곳: contracts `expenses.ts`(`EXPENSE_ACTIONS`), `expenses/status.ts` → `policy.ts`, `expenses/queries.ts`, `expenses/evidence.ts`, `expenses/service.ts`·`update.ts`, 웹 `finance/expense-view.ts`, `EvidenceSection.tsx`.
- 검토: 보통. 마이그레이션: 없음.

### 7. 신청 양식이 쓰는 계좌 닫기(N8) [ ]
- 할 수 있게 되는 것: 열린 행사의 신청 양식이 참가비를 받는 계좌는 닫히지 않고, 재정부는 왜 닫을 수 없는지 카드에서 본다.
- 수용 기준: 완료하지 않은 행사의 신청 양식(멈춤·마감 포함)이 참가비 받는 계좌로 가리키는 계좌를 닫으면 409 `ACCOUNT_IN_USE`이고 닫은 날이 없다. 그 행사를 완료했거나 양식의 계좌를 바꾸면 닫힌다. 계좌 응답의 동작은 `account.update`·`account.close`로 나뉘고, 쓰는 중이면 `account.close`가 없고 사용 양식 수가 실려 카드에 '신청 양식 N개에서 사용 중'이 보인다. 다른 학생회 양식은 세지 않는다(같은 값으로 두고 거르기를 지우면 실패). 진행 에이전트는 올리기 전에 두 DB에서 닫힌 계좌를 가리키는 완료 전 행사의 양식 수를 읽기로 세고 vada-docs RULE-34에 줄을 더한다.
- 닿는 곳: contracts `accounts.ts`, `errors.ts`, 새 `accounts/policy.ts`, `accounts/service.ts`·`queries.ts`, 웹 `finance/AccountCard.tsx`, `AccountsTab.tsx`, `lib/messages.ts`.
- 검토: 보통. 마이그레이션: 없음.

## 닫기

마지막 조각을 배포한 뒤 진행 에이전트가 사람에게 맡긴다(재정부원 휴대폰): 요청 하나의 품목 둘을 승인 → 하나를 [품목 취소] → 낸 사람에게 알림 → 다른 하나를 결제하고 증빙 → 행사 완료가 된다 → 완료한 행사의 지출에 [증빙 붙이기]가 없고, 새 지출의 항목 고르기에 그 행사 항목이 없다. 결과는 `docs/device-checks.md`에 옮긴다.

지표와 회고 세 줄은 이 아래에 적는다.
