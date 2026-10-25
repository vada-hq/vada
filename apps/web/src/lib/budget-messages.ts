// 예산 탭(회계 기간, 예산 편성, 항목 고치기·지우기)의 문구. 여러 화면이 같이 쓰는 문구는 messages.ts에 있다.
// messages.ts가 파일 길이 상한(300줄)에 닿아 참가 신청 문구(registration-messages.ts)처럼 나눴다.

// 예산 탭: 회계 기간 만들기, 예산 편성(여러 행), 항목 고치기·지우기. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const BUDGET_LOAD_FAILED = '예산을 불러오지 못했어요. 연결을 확인해 주세요.'
export const BUDGET_LOST = '예산을 볼 수 없어요. 학생회를 새로 불러왔어요.'
export const BUDGET_ERRORS: Record<string, string> = {
  FISCAL_PERIOD_CONFLICT:
    '기간이 겹치거나 같은 이름의 회계 기간이 있어요. 이름과 날짜를 확인해 주세요.',
  NO_FISCAL_PERIOD: '지금 회계 기간이 없어요. 먼저 회계 기간을 만들어 주세요.',
  EVENT_COMPLETED: '완료한 행사라 바꿀 수 없어요. 회장단이 완료를 취소하면 다시 할 수 있어요.',
  EVENT_INVALID: '이 학생회의 행사가 아니에요. 다른 행사를 골라 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
  BUDGET_ITEM_DUPLICATE: '같은 이름의 예산 항목이 있어요. 이름을 바꿔 주세요.',
  BUDGET_ITEM_IN_USE: '요청·지출·수입에 쓰였거나 고친 항목이라 지울 수 없어요.',
  PERIOD_CLOSED: '결산을 공개한 기간이라 바꿀 수 없어요.',
}
export const BUDGET_FAILED = '저장하지 못했어요. 다시 시도해 주세요.'
// 여러 행 넣기는 한 거래라, 실패하면 한 행도 남지 않는다. 창의 행은 그대로 둔다.
export const BUDGET_ROWS_UNSAVED = '아무것도 저장하지 않았어요.'
