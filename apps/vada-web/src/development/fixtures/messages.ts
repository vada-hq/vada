import type { DataRow } from '../../data-sources/definitions'

export const MESSAGE_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  // 와이어프레임이 그린 것은 방이 하나도 없는 모습뿐이다. 방을 넣으면 줄의 모양을
  // 개발용 응답이 지어내므로, 디자인 근거가 생길 때까지 빈 목록으로 둔다.
  'message.rooms': [],
  // 방이 없는 상태에서는 대화도 비어야 두 출처의 의미가 일치한다.
  'message.conversation': [],
}
