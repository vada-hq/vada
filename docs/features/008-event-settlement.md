---
독자: 에이전트
---

# 008 행사 정산과 환급

상한: 6시간(실제로 도는 시간). 시작 2026-10-23 01:55. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/008-조각번호`, 진행 기록은 `.superpowers/sdd/008/progress.md`, 이슈는 vada-hq/vada-docs#52다. 007(`docs/features/007-registration-attendance.md`, main 532e5c5)의 표(`registration`, `registration_link`, `attendance`), 경로(`apps/api/src/registrations/`), 권한 맥락(`registrations/permission-context.ts`의 `registrationContextOf`), 신청자 정보 비우기(`registrations/void-registration.ts`, `personal-values.ts`)에 기댄다. 007 명세나 코드가 이 문서와 어긋나면 007을 따르고 `Ruling:`으로 적는다. 이미 맞춘 것은 '위험'의 '007에 맞춘 것'에 있다.

## 왜

행사가 끝나면 재정부는 통장 앱과 엑셀을 오가며 참가비가 다 들어왔는지, 영수증·사유가 빠진 지출과 먼저 내고 못 받은 운영진이 없는지 맞춘다(domain.md '정산'). 회장단은 맞춘 숫자를 결과보고서와 다음 기수에게 넘긴다. 이 기능은 입금 확인, 행사에 이은 지출·예산·요청, 먼저 낸 사람 환급을 한 화면의 정산으로 모으고, 정산이 끝난 행사를 회장단이 완료해 잠근다. RFC-7 '꼭'(행사 정산과 환급), RFC-8 시험 2(정산 때 거래마다 다시 묻지 않는다), 리허설 관문의 "행사 참가 신청과 정산이 휴대폰으로 끝까지"다.

- 근거: DEC-4(완료하면 잠그고 회장단이 취소), DEC-39(정산 기준, 시작 전 완료 불가, 완료 취소 사유), DEC-40(사유와 환급이 정산 기준), DEC-28(완료는 회장단, 입금 확인은 행사 책임자와 행사 담당 부서, 돈은 재정), DEC-45(취소한 것은 합계에서 뺀다, 수입의 계좌), DEC-55(환불 대기와 환불함 뒤 비우기), DEC-61(VADA는 돈을 옮기지 않는다: 입금과 환불은 밖에서 하고 표시만 한다), DEC-63, logical-model '행사의 정산이 끝났는가'·'행사의 완료'.
- 이미 있는 것: 표 `deposit`, `income`, `approval`(대상 `event`, 결과 `completed`·`completion_cancelled`), `expense.event_id`, `budget_item.event_id`(0000). 지출 적기·취소·환급(`expenses/`, 005), 예산 항목(`budget/`), 구매 요청과 결재(`purchases/`), 행사(`events/`, 006), 계좌(`accounts/`). 기록 모듈은 지출과 예산 항목의 행사를 만든 뒤 바꾸지 못하게 막아 두었다(`records/records.ts`).
- 007이 만든 것(마이그레이션 0007·0008, 서버 `apps/api/src/registrations/`, 화면 `apps/web/src/registrations/`): 신청 양식, 공개 신청과 스스로 취소(`/api/public/…`, `apply.ts`, `cancel-mine.ts`), 운영진 취소(`cancel-by-staff.ts`), QR·이름 출석과 출석 취소(`attendance.ts`, `attendance.method`·`cancelled_at`), 신청자 목록과 열람 기록(`applicants.ts`, `access-log.ts`), 기한 지우기(`purge.ts`). 신청의 CHECK는 이미 `cancelled_at IS NULL OR student_id IS NULL`이다(0008): 취소하면 학번만 꼭 비고 이름·휴대폰 번호는 남을 수 있어, 환불 대기에 표 변경이 필요 없다. 권한 칸은 `registration.manage`(책임자, 행사 담당 부서, 회장단)와 `registration.view_applicants`(거기에 재정부)이고, 행사 담당 부서 기준은 `access/event-departments.ts`의 `eventDepartmentIdsOf`다. 학생회비 납부자 명단 `fee_payment`(`fee-payments/`)는 참가비 입금 기록 `deposit`과 다른 표다.
- `deposit`은 표와 drizzle 정의(`db/schema-work.ts`: `registrationId`, `amount`, `confirmedAt`, `incomeId`)만 있고 쓰는 코드가 없다. physical-model에 있는 `refunded_at`·`refund_amount`와 그 CHECK 둘은 DB(0000~0008)와 drizzle에 아직 없다.

### 원칙 대조

- 새로 하는 입력: 입금 확인은 지금 통장 앱을 보며 엑셀에 하는 체크를 신청 목록의 버튼 하나로 옮긴다. 누가 아직 안 냈는지 바로 보이는 이득이 확인하는 사람에게 있다. 요청·지출·예산 항목의 행사는 고를 수 있을 뿐 꼭은 아니고, 행사 화면에서 열면 채워져 있다. 사유 채우기는 DEC-40이 정한 정산 전 입력이고, 정산 화면이 빠진 지출만 모아 보여 찾는 수고를 없앤다. 완료는 회장단의 버튼 하나다. 정산이 끝났는지는 사람이 표시하지 않고 기록으로 센다(DEC-39 버린 안).
- 근거 연결: 정산의 남은 것마다 그 요청·지출로 간다. 참가비 수입은 입금 기록들을 가리킨다. 완료와 완료 취소는 결재 기록(누가, 언제, 사유)이다.
- 변경 이력: 입금 확인, 확인 취소(사유), 환불함, 지출의 사유·행사 바꾸기, 수입 취소가 모두 판으로 남는다. 완료 취소는 사유가 꼭 있다(PRIN-3).
- PRIN-5와 DEC-28: 정산 숫자와 남은 것은 모든 운영진이 보지만 신청자 이름·휴대폰 번호·사람마다의 입금액은 007의 신청자 정보 보기 권한(`registration.view_applicants`)이 있는 사람에게만 보인다. 정산 화면에는 합과 수만 있다.

## 범위 밖

- 007: 신청 양식, 공개 신청과 취소, 열람 기록, QR·이름 출석과 출석 취소, 학생회비 납부자 명단(`fee_payment`), 신청자 정보 비우기와 기한 지우기(이 기능은 `personal-values.ts`의 도우미를 부른다). 009: 일반 수입 적기·고치기·취소, 수입의 계좌, 결산, 기간 마감과 이월, 감사 증빙 묶음, `income.description`의 길이 상한(수입 API를 만들 때 정한다).
- 그 밖: 이전 행사, 행사방, 행사 지우기, 계좌 잔액과 거래 대조(DEC-61), #39·#48·#53, 먼저 낸 사람에게 가는 알림, 환급 때 환급 계좌 고르기, 정산서 엑셀, 업무 잠그기, 입금 기록의 입금자명, 요청과 예산 항목의 행사 바꾸기(요청은 취소하고 다시 낸다).

## 정한 것

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 요청의 행사 | 새 칸 `request.event_id`(비울 수 있음). 요청을 낼 때 고르고 바꾸지 않는다. 행사의 '결재를 기다리는 품목'은 이 칸으로 센다(품목의 예산 항목은 승인 전에 비어 있어 셀 수 없다) | screens.md 요청 상세 '이어진 행사', [QuickBooks 프로젝트별 수입·비용](https://quickbooks.intuit.com/community/help-articles-128/track-income-costs-and-profitability-by-project-284306) | 보통(새 칸) |
| 지출의 행사 | 적을 때 고르고, 재정부가 바꿀 수 있다(바꾸기 전과 뒤의 행사 모두 완료 전이어야 한다). 결제 내역의 요청에 행사가 있으면 지출의 행사는 그것과 같다. 요청들의 행사가 서로 다르면 409 `EVENT_MISMATCH` | QuickBooks 지출의 Customer/Project 칸(같은 주소), DEC-36 | 쉽다(코드) |
| 예산 항목의 행사와 종류 | 더할 때 종류(지출 기본, 수입)와 행사(선택)를 고른다. 바꾸지 않는다. 수입 항목은 결재와 지출에서 고를 수 없다 | DEC-45, screens.md 예산 | 쉽다 |
| 정산 기준 | logical-model의 다섯(결재 대기 품목, 승인했지만 결제하지 않은 품목, 증빙 없는 지출, 사유 없는 지출, 환급 전 지출)에 '환불 대기 신청'을 더한다. 갚을 돈이 남은 것은 환급 전 지출과 같다. 취소한 요청·지출·입금은 보지 않는다. 저장하지 않고 센다 | DEC-39, DEC-40, DEC-55, [Ramp 영수증·메모 요구](https://support.ramp.com/automate-receipts-and-expense-requirements) | 쉽다(계산) |
| 정산 숫자 | 예산: 그 행사 수입·지출 예산 항목의 합과 항목마다 쓴 돈(logical-model '예산 항목별로 쓴 돈'). 실제: 취소 뺀 행사 지출 합, 참가비(취소하지 않은 입금 − 환불)와 입금 수·환불 대기 수. 차이(예산 − 실제). 일반 수입은 009가 더한다 | [QuickBooks 예산 대비 실적](https://quickbooks.intuit.com/community/help-articles-128/track-income-costs-and-profitability-by-project-284306) | 쉽다 |
| 완료 | 회장단(`event.complete`). 시작 전·날짜 미정은 409 `EVENT_NOT_STARTED`, 정산이 남으면 409 `SETTLEMENT_PENDING`, 이미 완료면 409 `EVENT_COMPLETED`. 결재 기록 `completed`(사유는 적을 수만, 500자). 완료 취소는 사유가 꼭 있고 `completion_cancelled`, 완료가 아니면 409 `EVENT_NOT_COMPLETED`. 끝나지 않은 업무는 수만 보이고 막지 않는다. 상태에 '완료'(목록에서는 끝남 자리) | DEC-4, DEC-39, logical-model '행사의 완료' | 쉽다 |
| 잠금 범위 | 완료한 행사에서 409 `EVENT_COMPLETED`: 행사 고치기·책임자, 그 행사 요청의 내기·취소·결재, 그 품목을 결제하는 지출, 그 행사 지출의 적기·취소·환급·증빙·사유·행사 바꾸기(그 행사로 옮기기 포함), 그 행사 예산 항목 더하기와 결재·지출에서 고르기, 그 행사 예산 항목을 쓴 지출(항목을 고른 지출, 그 항목으로 승인한 품목을 결제한 지출)의 적기·취소·환급·증빙, 신청 양식·신청·참석·입금·환불(007과 이 기능의 쓰기 모두). 업무는 잠그지 않는다. 읽기는 된다. 회장단이 완료를 취소하면 다시 열린다 | DEC-4 결과(업무는 알리기만), [Xero lock date](https://www.chargebee.com/docs/1.0/integrations/articles-and-faq/understanding-lock-dates-in-xero.html)(잠근 날 전 거래는 더하거나 고치지 못하고, 권한자가 풀 수 있다) | 쉽다(코드) |
| 참가비 수입 | 완료하는 거래에서 참가비 받는 계좌마다 수입 하나(`participation_fee`, 금액은 취소하지 않은 입금 − 환불, 0이면 만들지 않음, 받은 날은 그 계좌 마지막 입금 확인일(한국), 회계 기간은 그날이 든 기간, 내용 "{행사 이름} 참가비", 예산 항목 없음)를 만들고 입금 기록마다 그 수입을 잇는다. 그날이 든 회계 기간이 없으면 409 `NO_FISCAL_PERIOD`이고 완료되지 않는다. 완료 취소는 그 수입을 같은 사유로 취소하고, 다시 완료하면 새로 만든다 | screens.md 흐름 3 "참가비 수입에 모인다", [QuickBooks 여러 입금을 한 건으로](https://quickbooks.intuit.com/learn-support/en-ca/help-article/bank-deposits/record-make-bank-deposits-quickbooks-online/L2BBZOPdr_CA_en_CA), 옛 vada M3b-2(정산 때 수입으로) | 보통(운영 DB에 수입 행이 생긴다. 취소로 되돌린다) |
| 입금 확인 | 행사 책임자와 행사 담당 부서 사람(`deposit.confirm`, 007의 신청 관리 칸 `registration.manage`와 같은 기준이라 회장단도 물려받는다. '007에 맞춘 것' Ruling). 금액은 적용 참가비로 채우고 1원~10억 원. 신청마다 취소하지 않은 입금 기록은 하나(409 `DEPOSIT_EXISTS`, DB 부분 유일 인덱스). 확인 취소는 새 칸 `deposit.cancelled_at`과 사유(판). 환불한 입금의 확인 취소는 409 `DEPOSIT_CLOSED`, 취소한 신청의 입금 확인은 404(Ruling) | DEC-28, [Hi.Events 오프라인 결제 Mark as paid](https://hi.events/docs/help-center/payments-and-billing/offline-payments), physical-model '행은 지우지 않고 취소한다' | 보통(새 칸, 인덱스) |
| 환불함 | 재정부만(`finance.manage`). 환불 대기(취소한 신청에 취소하지 않은 환불 전 입금)에만, 한 번, 되돌리지 않는다. 금액은 입금액으로 채우고 1원~입금액. 같은 거래에서 007 도우미(`personal-values.ts`의 `clearVersionValues`와 지금 값 비우기)로 그 신청의 이름·휴대폰 번호를 지금 값과 모든 판에서 비운다. 입금한 신청을 취소하면(007의 `voidRegistration`, 스스로 취소와 운영진 취소가 같이 부른다) 이름·휴대폰 번호를 남기고 학번만 비운다 | DEC-55, [Stripe 부분 환불은 결제액까지](https://docs.stripe.com/api/refunds/create) | 어렵다(비운 값은 되살리지 못한다) |
| 오류 | 409 `EVENT_COMPLETED`, `EVENT_NOT_COMPLETED`, `EVENT_NOT_STARTED`, `SETTLEMENT_PENDING`, `EVENT_MISMATCH`, `DEPOSIT_EXISTS`, `NO_DEPOSIT`, `DEPOSIT_CLOSED`, `NOT_REFUNDABLE`. 이미 있는 `EVENT_INVALID`, `NO_FISCAL_PERIOD`, `BUDGET_ITEM_INVALID`, `EXPENSE_CANCELLED`를 같이 쓴다. 403이 409보다 먼저다 | [RFC 9110 403](https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden), 기능 005·006 | 쉽다 |

## 위험

- **표 변경 둘(`0009`, `0010`).** A(`0009`)는 새 칸과 새 칸의 제약만: `request.event_id`(외래 키와 인덱스), `deposit.cancelled_at`, `deposit.refunded_at`·`refund_amount`와 physical-model의 CHECK 둘(환불액 0~입금액, 둘 다 있거나 둘 다 없다. 설계에는 있고 DB에 없던 칸이다). 조각 1이 drizzle 정의에 새 칸을 더하므로 A를 두 DB에 먼저 적용한 뒤 조각 1을 올린다. B(`0010`)는 이미 있는 칸에 걸리는 제약: `deposit (registration_id) WHERE cancelled_at IS NULL` 부분 유일 인덱스. 설계에서 이 인덱스가 표 바로 아래에 있어 `deposit_registration_id_idx` 이름을 받으므로, 0008의 attendance처럼 기존 일반 인덱스를 먼저 `deposit_registration_id_idx1`로 바꾼다. A와 B를 한 파일에 섞지 않는다. 검토가 끝난 뒤 적용한다. 차례는 아래 '007에 맞춘 것'의 Ruling을 따른다.
- **시작 때 vada-docs에 반영**(진행 에이전트가 조각 1 전에): physical-model `request.event_id`와 인덱스, `deposit.cancelled_at`과 부분 유일 인덱스. '막지 못하는 규칙'에 넷: 완료한 행사의 기록 잠금 범위(업무 제외), 지출의 행사는 결제한 품목 요청의 행사와 같다, 참가비 수입은 완료 때 계좌마다 하나이고 완료 취소 때 취소한다, 취소한 입금 기록은 정산·수입에서 뺀다. logical-model: 요청에 행사, 입금 기록에 취소한 시각, '행사의 정산이 끝났는가'에 환불 대기. 새 결정 기록 하나(다음 번호): 정산 기준에 환불 대기를 더함, 잠금 범위, 참가비 수입을 완료 때 만듦, 입금 확인 취소. DEC-39와 screens.md '행사' 돈 탭에 그 결정을 가리키는 한 줄.
- **잠금이 새지 않게.** 잠금 확인은 공유 도우미 하나(`events/completion.ts`)이고, 쓰기 거래마다 학생회 행 잠금(`access/authorize.ts`의 `lockCouncil`, 운영진 경로는 `inCouncilChange`가 잡는다) 뒤에 부른다(완료도 같은 순서라 겹치면 하나로 정해진다). `boundary.test.ts`처럼 잠금 범위의 경로를 모두 도는 표 시험을 두고(옛 vada의 `completion-lock.test.ts`가 같은 일을 했다), 확인을 지우면 실패하게 한다(자주 잡힌 것 11, 14). 007의 운영진 경로는 이미 `inCouncilChange` → 권한 → 신청 행 잠금(`registration-lock.ts`의 `lockRegistration`) 순서다. 공개 신청(`apply.ts`, 양식 행 잠금 `lockForm`)과 스스로 취소(`cancel-mine.ts`, `lockRegistration`)는 학생회 행을 잠그지 않으므로, 코드·토큰으로 학생회 번호를 먼저 읽고 `lockCouncil` → 양식·신청 행 잠금 → 다시 읽기 순서로 맞춘다. 이 기능 뒤에 행사에 닿는 쓰기 경로를 더하는 기능은 그 표에 더한다.
- **007에 맞춘 것.** 007(main 532e5c5)의 실제 이름에 맞췄다. 취소 경로는 입금이 있으면 이름·휴대폰 번호를 남기도록 이 기능이 고친다(조각 2).
  - Ruling: 입금 확인 권한 `deposit.confirm`은 007의 `registration.manage`와 같은 기준(`event_owner`, `event_department`, `leadership`)이고 맥락은 `registrationContextOf`다. 이 문서의 "책임자와 행사 담당 부서"와 "007의 신청 관리 칸과 같은 기준"이 어긋나, 007(DEC-67 회장단 상속)을 따랐다.
  - Ruling: 신청 경로는 `/api/organizations/:councilId/registrations/:registrationId/…`(007의 `cancel`, `attendance`와 같은 줄)이고, 신청자 상세 경로·화면은 없다. 입금 상태는 신청자 목록(`GET registration-forms/:formId/applicants`, `applicants.ts`, 계약 `Applicant`)과 그 줄의 동작(화면 `ApplicantActions.tsx`)에 싣는다.
  - Ruling: 007의 신청자 목록은 취소한 신청과 이름이 빈 신청을 빼고, 운영진 쓰기의 신청 읽기(`staff-registration.ts`의 `lockedLiveRegistration`)도 취소한 신청을 404로 본다. 환불 대기(취소했고 이름이 남은 신청)는 목록에 남기고, 환불은 취소한 신청을 잠가 읽는 따로의 읽기를 쓴다. 환불한 신청은 이름이 비어 007대로 목록에서 빠진다(목록의 입금 상태에 '환불함'은 없고, 정산 숫자와 환불 응답으로 본다).
  - Ruling: 판에서 비우는 007 도우미 `clearVersionValues`는 이름·학번·휴대폰을 함께 비운다. 입금한 신청의 취소는 학번만 비우므로 `personal-values.ts`에 학번만 비우는 도우미를 더하고 `voidRegistration`이 입금 여부로 고른다.
  - Ruling: 기한 지우기(`purge.ts`)와 학생회비 납부자 명단(`fee-payments/`)은 완료 잠금 밖이다. 기한 지우기는 DEC-55의 보관 기간이라 완료한 행사에서도 돌고, 명단은 행사에 닿지 않는다.
  - Ruling: 다음 마이그레이션은 `0009`(A)와 `0010`(B)이다. 적용 스크립트는 남은 마이그레이션을 모두 적용하므로 A를 조각 1 전에 적용하면 B도 함께 적용된다. main 532e5c5에는 `deposit`에 쓰는 코드가 없고(drizzle 정의뿐) 조각 1도 쓰는 경로를 더하지 않으므로, 적용 전에 main에서 `INSERT INTO deposit|insert\(deposit\)`가 시험 밖에 없는지와 두 DB에서 B의 위반이 0건인지 보고 A·B를 dev → production 차례로 함께 적용한다.
  - Ruling: 환불 대기인 신청(취소했고 입금이 남은 신청)의 입금 확인을 취소하면 같은 거래에서 이름·휴대폰 번호도 비운다. 입금이 없어지면 남겨 둘 이유(환불 연락)가 사라지고, 007의 "입금 전 취소는 모두 비운다"와 같은 끝 상태가 된다(DEC-55, [GDPR 5(1)(c) 최소 수집](https://gdpr-info.eu/art-5-gdpr/)). 막으면(409) 잘못 누른 확인을 되돌릴 길이 없다.
  - Ruling: 취소한 신청에 입금을 확인하면 409 `DEPOSIT_CLOSED`가 아니라 007 운영진 경로(`lockedLiveRegistration`)대로 404 `NOT_FOUND`다. 같은 줄의 경로가 취소한 신청을 같은 응답으로 다뤄야 화면이 하나의 규칙(대상이 사라지면 창을 닫는다)으로 처리한다. `DEPOSIT_CLOSED`는 환불한 입금의 확인 취소에만 쓴다.
  - Ruling: 공개 신청과 스스로 취소에는 학생회 행 잠금을 더하지 않는다(선착순 신청이 같은 학생회의 다른 변경 뒤에 줄 서지 않게). 대신 완료와 완료 취소가 행사 행을 `FOR NO KEY UPDATE`로 잠그고(업무·양식을 넣을 때의 외래 키 검사는 막지 않고 `FOR SHARE`와는 부딪힌다), 행사에 닿는 쓰기는 잠금 확인 때 행사 행을 `FOR SHARE`로 읽는다. 완료와 신청이 겹치면 행사 행에서 하나로 정해진다. pg-smoke에 '완료와 공개 신청이 겹침'을 더한다.
  - Ruling: 지출의 행사와 고른 예산 항목의 행사가 둘 다 있는데 다르면 409 `EVENT_MISMATCH`다. 다르면 정산의 '항목마다 쓴 돈'과 '실제'가 서로 다른 행사로 갈린다(조각 5 검토).
  - Ruling: 지출 상세 `actions`에 재정부의 고치기 `expense.update`를 두고, 취소했거나 완료로 잠긴 지출에서는 뺀다. 완료한 행사의 양식·신청·지출·요청 동작은 서버가 `actions`에서 뺀다(조각 4 검토).
- **돈과 동시 처리.** `numeric`은 문자열로 오고 계약은 정수 원이다. 합은 정수로 센다. 두 사람이 같은 신청을 동시에 입금 확인, 완료와 그 행사 지출 적기, 완료와 입금 확인이 겹치는 경우를 실제 PostgreSQL 점검(pg-smoke)에 더한다.
- **개인정보.** 입금 기록은 신청자마다의 금액이고 환불 대기는 이름·휴대폰 번호를 남긴다. 로그와 Sentry에 신청 번호, 이름, 금액을 넣지 않는다. 환불함 뒤 비우기는 되돌릴 수 없어 깊게 검토한다. 보관 기간은 DEC-55다.
- **새 라우트 모듈 둘**(`settlement`, `deposits`): `AppOptions`로만 잇고 `boundary.test.ts`가 검사한다. 새 비밀 값과 의존성은 없다.
- **009와 잇는 곳.** 완료하지 않은 행사의 참가비는 수입 표에 없다. 결산과 기간 마감(009)은 완료하지 않은 행사를 막거나 보여 줘야 한다. 009 모양 잡기에 넘긴다.

### 사람이 시작 전에 할 일

없음. 닫을 때의 기기 확인('닫기')만 사람이 한다.

## 조각

1 → 2 → 3 → 4 → 5는 서버라 차례로 한다. 6은 4·5가, 7은 2·5가 main에 오른 뒤 시작하고 둘은 함께 해도 된다. 시간이 모자라면 7의 행사 고르기 → 6의 지출 고치기 차례로 뺀다(행사 화면에서 연 요청·지출은 행사가 채워진다).

### 1. 표 칸, 기록 종류, 권한 칸 [x]
- 할 수 있게 되는 것: 서버가 요청의 행사, 입금 기록, 수입을 학생회 경계와 판 규칙 안에서 쓰고, 완료와 입금 확인 권한을 묻는다.
- 수용 기준: 요청을 다른 학생회 행사로, 입금 기록을 다른 학생회 신청으로, 수입을 다른 학생회의 회계 기간·예산 항목·계좌로 만들면 실패하고 하위 행과 판이 없다. 입금 기록과 수입을 만들면 판 1, 바꾸면 판이 는다. 입금 기록의 신청·금액, 수입의 회계 기간·출처·금액, 요청의 행사는 바꾸지 못하고, 지출의 행사와 입금 기록의 수입은 바꿀 수 있으며 바꿀 때도 같은 학생회를 다시 본다(drizzle 이름과 DB 칸 이름 모두). B 뒤 같은 신청에 취소하지 않은 입금 기록 둘은 DB가 거절한다. 환불액이 입금액보다 크거나 환불 시각과 금액 가운데 하나만 있으면 DB가 거절한다. 권한표에 `event.complete`(회장단)와 `deposit.confirm`(`registration.manage`와 같은 `event_owner`·`event_department`·`leadership`, 맥락이 없으면 책임자·담당 부서 기준은 거부)이 있고, 내 권한 목록에서 회장단은 `event.complete`와 `deposit.confirm`을 받는다. `check:design`이 설계와 같다고 낸다.
- 닿는 곳: `apps/api/migrations/0009_*.sql`, `0010_*.sql`과 `migrations/meta/_journal.json`, `db/schema-work.ts`(`request`, `deposit`), `db/schema-money.ts`, `db/baseline.test.ts`, `records/records.ts`(종류 `deposit`, `income`), `records/same-council.ts`, `records/registration-records.test.ts`, `access/permissions.ts`, contracts `permissions.ts`.
- 검토: 깊게. 마이그레이션: 있음('위험'의 A·B 차례).

### 2. 입금 확인, 확인 취소, 환불함(서버) [x]
- 할 수 있게 되는 것: 행사 담당이 신청마다 입금을 확인하거나 취소하고, 재정부가 환불 대기 신청에 환불을 표시한다.
- 수용 기준: 신청 관리 권한자(책임자, 행사 담당 부서, 회장단)만 확인하고(그 밖의 부원과 재정부만인 사람 403) 201이며 금액을 빼면 적용 참가비다. 0원과 10억+1은 400, 취소한 신청은 404, 이미 확인했으면 409 `DEPOSIT_EXISTS`, 동시에 둘이 확인해도 하나만 된다. 확인 취소는 사유를 받아 판에 남기고, 입금 기록이 없으면 409 `NO_DEPOSIT`, 환불했으면 409 `DEPOSIT_CLOSED`다. 환불 대기인 신청의 확인을 취소하면 같은 거래에서 이름·휴대폰 번호가 빈다. 입금한 신청을 취소하면(스스로 취소와 운영진 취소 모두) 학번만 지금 값과 모든 판에서 비고 이름·휴대폰 번호가 남아 '환불 대기'가 된다. 개인 링크는 007대로 지운다. 입금 전 취소는 007대로 모두 빈다. 입금 확인과 취소가 겹치면 신청 행 잠금으로 하나로 정해진다. 환불함은 재정부만(책임자 403), 환불 대기가 아니면 409 `NOT_REFUNDABLE`, 입금액보다 크면 400이다. 환불하면 환불 시각과 금액이 남고, 같은 거래에서 그 신청의 이름·휴대폰 번호가 지금 값과 모든 판에서 비며 입금 금액은 남는다. 007의 신청자 목록(`GET registration-forms/:formId/applicants`)에 입금 상태(없음, 확인과 금액, 환불 대기)와 거르기(입금, 환불 대기)가 있고, 환불 대기인 취소한 신청은 목록에 남으며 환불한 신청은 이름이 비어 빠진다. 열람 권한(`registration.view_applicants`)이 없는 사람은 007대로 403이고 열람 기록이 없다. 양식의 `actions`에 `deposit.confirm`이 있다. 다른 학생회 404, 403, 401, AGENTS.md의 입력 경우를 시험한다. 로그에 이름과 금액이 없다.
- 닿는 곳: contracts `deposits.ts`(새: `ConfirmDepositSchema`, `CancelDepositSchema`, `RefundSchema`, 입금 상태), `registrations.ts`(`Applicant`에 입금 상태와 취소 여부, `REGISTRATION_ACTIONS`에 `deposit.confirm`), `errors.ts`. `apps/api/src/deposits/`(새: `routes.ts`, `service.ts`, `queries.ts`), 007의 `registrations/void-registration.ts`(입금이 있으면 학번만), `personal-values.ts`(판에서 학번만 비우는 도우미), `applicants.ts`(`applicantRowsOf`가 환불 대기를 포함), `queries.ts`(양식 `actions`), `app.ts`(`AppOptions`), `serve.ts`, `http/boundary.test.ts`, `ops/pg-smoke/`(`pg-smoke-registration-cases.ts` 옆에 입금 사례). 경로는 `/api/organizations/:councilId/registrations/:registrationId/` 아래 `POST deposit`, `deposit/cancel`, `refund`. 거래는 `inCouncilChange` → 권한(`registrationContextOf`) → `lockRegistration` → 다시 읽기 순서다(007의 `lockedLiveRegistration`과 같고, 환불은 취소한 신청을 읽어야 해서 그것을 쓰지 않는다).
- 검토: 깊게(돈, 개인정보 비우기). 마이그레이션: 없음.

### 3. 행사 정산 읽기 [x]
- 할 수 있게 되는 것: 모든 운영진이 행사의 예산 대비 수입·지출과 정산에 남은 것을 본다.
- 수용 기준: `GET events/:eventId/settlement`는 '정한 것'의 정산 숫자, 남은 것(종류별 수와 대상: 요청 번호·제목, 지출 번호·사용처·금액. 환불 대기는 수만), `settled`, 완료 여부와 완료·완료 취소 결재(누가, 언제, 사유)를 준다. 취소한 요청·지출·입금은 숫자와 남은 것에서 빠지고, 다른 행사와 상시 지출은 섞이지 않는다. 환급하면, 사유를 채우면, 증빙을 붙이면, 품목을 결제하면, 환불하면 그 줄이 남은 것에서 빠지는 것을 하나씩 시험한다. 응답에 신청자 이름과 휴대폰 번호가 없다. 행사 목록과 상세의 상태가 완료를 센다(완료 결재가 마지막이면 완료). 다른 학생회 행사와 형식이 틀린 번호 404, 운영진 아님 403, 401. JSON은 `no-store`다.
- 닿는 곳: contracts `settlement.ts`(새: `EventSettlement`, `SettlementRemaining`, `SettlementResponse`), `events.ts`(상태 `completed`). `apps/api/src/settlement/`(새: `routes.ts`, `queries.ts`, `remaining.ts`), `events/status.ts`, `events/queries.ts`, `app.ts`, `serve.ts`.
- 검토: 깊게(돈 계산). 마이그레이션: 없음.

### 4. 완료, 완료 취소, 잠금, 참가비 수입 [x]
- 할 수 있게 되는 것: 회장단이 정산이 끝난 행사를 완료해 기록을 잠그고 참가비가 수입으로 모이며, 잘못 완료했으면 사유와 함께 되돌린다.
- 수용 기준: `POST events/:eventId/complete`와 `…/cancel-completion`은 회장단만(책임자인 부원 403)이고 '정한 것'의 409를 낸다. 완료하면 결재 기록과 '정한 것'의 참가비 수입이 생기고 입금 기록이 그 수입을 가리킨다. 회계 기간이 없으면 아무것도 생기지 않는다. 완료 취소는 공백만인 사유 400이고, 수입을 같은 사유로 취소한다. 다시 완료하면 새 수입이 생기고 취소한 수입은 남는다. 완료한 행사에서 '정한 것'의 잠금 범위 경로는 모두 409 `EVENT_COMPLETED`이고 아무것도 쓰지 않는다(표 시험, 확인을 지우면 실패). 007의 쓰기 경로 열 개(양식 만들기·고치기·멈추기·다시 받기, 공개 신청, 스스로 취소, 운영진 취소, QR 출석, 이름 출석, 출석 취소)가 표에 모두 있다. 업무 쓰기, 모든 읽기, 기한 지우기, 납부자 명단은 된다. 완료 취소 뒤에는 다시 된다. 완료와 그 행사 지출 적기, 완료와 입금 확인을 동시에 하면 하나로 정해진다. 행사 상세의 `actions`에 완료·완료 취소가 있고 이력에 결재가 보인다. 끝나지 않은 업무가 있어도 완료된다.
- 닿는 곳: contracts `events.ts`(`CompleteEventSchema`, `CancelCompletionSchema`, 동작), `errors.ts`. `events/completion.ts`(새: 완료 여부와 잠금 확인), `settlement/complete.ts`·`fee-income.ts`(새), 잠금을 부르는 곳: `events/service.ts`, `purchases/service.ts`·`decide.ts`, `expenses/service.ts`·`evidence.ts`, `budget/service.ts`, `deposits/service.ts`, 007의 신청 쓰기 모듈(`registrations/service.ts`의 `createForm`·`updateForm`·`setPaused`, `apply.ts`·`cancel-mine.ts`(`lockCouncil`도 더한다), `cancel-by-staff.ts`, `attendance.ts`의 `checkInByQr`·`checkInManually`·`cancelAttendance`), `ops/pg-smoke/`.
- 검토: 깊게(잠금, 돈, 동시 처리). 마이그레이션: 없음.

### 5. 행사 잇기와 지출 고치기(서버) [x]
- 할 수 있게 되는 것: 운영진이 요청을, 재정부가 예산 항목과 지출을 행사에 잇고, 재정부가 정산 전에 지출의 사유와 행사를 고친다.
- 수용 기준: 요청 내기, 예산 항목 더하기(종류와 행사), 지출 적기가 `eventId`를 받고 다른 학생회 행사는 409 `EVENT_INVALID`, 완료한 행사는 409 `EVENT_COMPLETED`다. 결제 내역의 요청 행사와 지출의 행사가 다르면 409 `EVENT_MISMATCH`이고, 요청에 행사가 있으면 지출의 행사를 빼도 그 행사로 채운다. 수입 예산 항목을 결재나 지출에 고르면 409 `BUDGET_ITEM_INVALID`다. `POST expenses/:expenseId`는 재정부만 사유와 행사를 바꾸고, 같은 값이면 판이 늘지 않으며, 취소한 지출 409 `EXPENSE_CANCELLED`, 결제 내역이 있는 지출의 행사를 요청과 다르게 바꾸면 409 `EVENT_MISMATCH`다. 지출 상세 이력에 사유·행사 바꿈이 보인다. `GET expenses?event=`와 `GET purchase-requests?view=all&event=`는 그 행사의 것만 주고 다른 학생회 행사는 404다. 지출·요청의 요약과 상세, 예산 항목에 행사 이름이 있다. `GET budget`은 수입 항목을 종류와 함께 준다. 기존 시험이 그대로 통과한다.
- 닿는 곳: contracts `purchases.ts`, `budget.ts`, `expenses.ts`(`UpdateExpenseSchema`, 행사), `errors.ts`. `purchases/service.ts`·`queries.ts`, `budget/service.ts`·`queries.ts`, `expenses/service.ts`·`queries.ts`·`routes.ts`·`history.ts`, `records/records.ts`.
- 검토: 깊게(돈, 격리). 마이그레이션: 없음.

### 6. 행사의 돈 탭, 완료, 지출 고치기 화면 [ ]
- 할 수 있게 되는 것: 운영진이 행사 화면의 '돈' 탭에서 정산을 보고, 재정부가 빠진 사유를 채우며, 회장단이 완료하거나 완료를 취소한다.
- 수용 기준: 행사 하나에 007의 탭(개요, 업무, 참가 신청) 옆 탭 '돈'이 있고 예산·실제·차이, 예산 항목마다 쓴 돈, 남은 것 목록(누르면 그 요청이나 지출이 열린다), "정산이 끝났어요"가 보인다. 완료한 행사는 상태 배지 '완료'와 "완료한 행사라 바꿀 수 없어요"가 보이고 바꾸는 버튼이 없다. [완료]는 `actions`에 있을 때 확인(끝나지 않은 업무 수를 알린다, 사유 칸 선택)을 거치고, [완료 취소]는 사유를 꼭 받는다. 지출 상세에 재정부에게 [고치기](사유, 행사)가 있다. 409(`SETTLEMENT_PENDING`, `EVENT_NOT_STARTED`, `NO_FISCAL_PERIOD`, `EVENT_COMPLETED`) 문구가 그 동작 옆에 보이고, 두 번 누름, 404·403에 대화상자 닫기, 다시 보일 때와 내 변경 뒤 다시 읽기를 시험한다. 부품 확인 화면에 정산 요약과 '완료' 배지가 있다. 390px과 데스크톱으로 확인한다.
- 닿는 곳: `apps/web/src/events/`(`EventDetailView.tsx`, 돈 탭 새, 완료 대화상자 새, `EventCard.tsx`), `finance/`(`ExpenseDetailDialog.tsx`, `ExpenseActions.tsx`, 지출 고치기 새), `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통(쓴 `components/ui` 부품의 주석 조건). 마이그레이션: 없음.

### 7. 입금 확인·환불 화면과 행사 고르기 [ ]
- 할 수 있게 되는 것: 행사 담당이 휴대폰의 신청 목록에서 입금을 확인하고, 재정부가 환불을 표시하며, 요청·예산 항목·지출을 행사에 잇는다.
- 수용 기준: 007의 신청자 목록 줄에 입금 상태와 [입금 확인](양식 `actions`에 `deposit.confirm`이 있을 때, 금액은 적용 참가비로 채움)이 있고, 같은 줄의 동작(007은 상세 화면이 없다)에 [확인 취소](사유)와 재정부(내 권한 목록의 `finance.manage`)의 [환불함](금액)이 확인을 거쳐 보인다. 거르기 '입금 안 함'과 '환불 대기'가 있다. 입금한 신청을 [신청 취소]하면 줄이 빠지지 않고 '환불 대기'로 바뀌며, 그 확인 창은 학번만 지워진다고 알린다(입금 전 취소는 007의 문구와 동작 그대로). 요청 내기, 예산 항목 더하기, 지출 적기에 '행사'(없음과 완료하지 않은 행사)가 있고 행사 화면에서 열면 그 행사로 채워진다. 지출에서 품목을 고르면 요청의 행사로 채워지고 잠긴다. 예산 항목 더하기에 종류(지출, 수입)가 있고, 결재와 지출의 예산 항목 고르기 목록에는 지출 항목만 보인다. 409 문구, 두 번 누름, 404·403을 시험한다. 390px과 데스크톱으로 확인한다. 400줄을 넘을 것 같으면 행사 고르기를 나눈다.
- 닿는 곳: 007의 신청 화면 `apps/web/src/registrations/`(`ApplicantList.tsx`, `ApplicantRow.tsx`, `ApplicantActions.tsx`, `useApplicants.ts`, `registration-api.ts`), `finance/`(`RequestCreateDialog.tsx`, `BudgetItemDialog.tsx`, `ExpenseCreateDialog.tsx`, `ExpenseRequestFields.tsx`, `ExpenseDirectFields.tsx`), `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통(부품 주석 조건). 마이그레이션: 없음.

## 닫기

마지막 조각을 배포한 뒤 진행 에이전트가 사람에게 아래 기기 확인을 맡기고, 결과(날짜, 기기, OS, 브라우저, 단계마다 됨·안 됨)를 `docs/device-checks.md`의 새 절 '행사 정산'에 옮긴다. A는 아이폰 홈 화면 앱(회장), B는 갤럭시 Chrome(재정부원이자 행사 책임자). 먼저 B가 회계 기간, 행사 "정산 확인"(시작한 행사), 참가비 있는 신청 양식을 두고, 다른 기기로 신청 둘을 넣는다.

1. B가 신청 둘의 입금을 확인한다 → 돈 탭의 참가비가 그만큼이다. 하나를 신청자 쪽에서 취소한다 → 환불 대기 1, "정산이 끝났어요"가 아니다.
2. B가 그 행사 화면에서 사유 없이 사비 지출을 적고(먼저 낸 사람 A) 영수증을 붙인다 → 남은 것에 사유 없음과 환급 전이 보인다.
3. A가 [완료]를 누른다 → 정산이 남았다는 문구. B가 사유를 채우고 [환급함], 환불 대기에 [환불함] → "정산이 끝났어요".
4. A가 완료한다 → '완료' 배지, B의 화면에서 지출 취소와 입금 확인이 막힌다. 재정의 수입에 "정산 확인 참가비"가 있다(009 전이면 서버 응답으로 본다).
5. A가 사유와 함께 완료를 취소한다 → 다시 열리고 수입은 취소로 남는다.

지표와 회고 세 줄은 이 아래에 적는다.
