// 행사 색(② 행사, c2 확정 시안): 행사 하나의 정체성 색. 범주 색 가운데 분홍·주황(위험 빨강과 헷갈림)을 뺀 여섯이고 차례를 바꾸지 않는다.
// 시연 동안은 저장하지 않고 서버가 고정 규칙(완료하지 않은 행사를 만든 차례 mod 6)으로 정한다(c235 7.1). 시연 뒤 저장색으로 바꾼다.
export const EVENT_COLORS = ['lime', 'sky', 'violet', 'emerald', 'indigo', 'teal'] as const
export type EventColorKey = (typeof EVENT_COLORS)[number]
