// 수입 탭(목록, 적기, 상세, 취소)의 문구. 여러 화면이 같이 쓰는 문구는 messages.ts에 있다.
// messages.ts가 파일 길이 상한(300줄)에 닿아 예산 문구(budget-messages.ts)처럼 나눴다.
import { changeErrors } from './change-errors'
import { PERIOD_CLOSED } from './messages'

// 수입 탭: 목록, 적기, 상세, 취소. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const INCOMES_LOAD_FAILED = '수입을 불러오지 못했어요. 연결을 확인해 주세요.'
export const INCOME_LOAD_FAILED = '이 수입을 불러오지 못했어요. 연결을 확인해 주세요.'
export const INCOME_LOST = '이 수입을 볼 수 없어요. 다른 학생회의 수입이거나 없어졌을 수 있어요.'
export const INCOME_ITEMS_FAILED = '예산 항목을 불러오지 못했어요. 항목 없이 적을 수 있어요.'
export const INCOME_ERRORS = changeErrors({
  NO_FISCAL_PERIOD:
    '받은 날이 든 회계 기간이 없어요. 날짜를 확인하거나 예산 탭에서 기간을 먼저 만들어 주세요.',
  PERIOD_CLOSED,
  EVENT_COMPLETED:
    '완료한 행사의 예산 항목이라 바꿀 수 없어요. 회장단이 완료를 취소하면 다시 바꿀 수 있어요.',
  BUDGET_ITEM_INVALID: '고를 수 없는 예산 항목이에요. 다른 항목을 골라 주세요.',
  ACCOUNT_INVALID: '고를 수 없는 계좌예요. 닫았을 수 있어요. 다른 계좌를 골라 주세요.',
  INCOME_CANCELLED: '이미 취소된 수입이에요. 새로 불러왔어요.',
  INCOME_AUTOMATIC:
    '참가비와 이월금 수입은 직접 취소할 수 없어요. 행사 완료를 취소하거나 결산을 다시 열면 바뀌어요. 새로 불러왔어요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
  COMMAND_REUSED: '앞서 보내던 수입과 달라서 새로 준비했어요. 다시 적어 주세요.',
  COMMAND_CONFLICT: '다른 요청과 겹쳤어요. 다시 적어 주세요.',
})
export const INCOME_PERIOD_NOT_STARTED =
  '이 기간은 아직 시작하지 않아 받은 날을 고를 수 없어요. 시작한 뒤에 적어 주세요.'
export const INCOME_FAILED = '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
