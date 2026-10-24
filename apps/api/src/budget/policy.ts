// 예산 항목 정책(기능 014): 결재·지출·수입의 고르기 목록에 나올 수 있는지의 판정을 서버가 한 곳에서 낸다.
// 규칙의 원문은 RULE-11(완료한 행사의 기록은 잠겼다)이다. 쓰기의 거절(EVENT_COMPLETED)은 같은 사실(완료한 행사 집합)에서 나온다.

// 고를 수 있는 항목은 행사가 없거나 그 행사가 완료 전인 것이다. 화면은 이 값만 쓴다.
export const budgetItemSelectable = (itemEventId: string | null, completed: ReadonlySet<string>) =>
  itemEventId === null || !completed.has(itemEventId)
