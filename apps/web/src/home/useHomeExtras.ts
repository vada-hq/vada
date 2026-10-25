import { useEvents } from '../events/useEvents'
import { usePurchases } from '../finance/usePurchases'
import { openRequests, weekEvents } from './home-view'

// 홈 응답에 없는 것: 내 요청, 이번 주 행사. 원래 화면의 읽기를 그대로 쓴다.
// 읽지 못한 것은 빈 목록으로 두어 그 부분만 빠진다(홈 전체를 막지 않는다).
// 회장단은 행사를 학생회 부분에서 보므로 행사 목록을 읽지 않는다.
export function useHomeExtras(
  councilId: string,
  today: string,
  onForbidden: () => void,
  withEvents: boolean,
) {
  const requests = usePurchases(councilId, 'mine', onForbidden).state
  const events = useEvents(councilId, onForbidden, withEvents).state
  return {
    requests: requests.kind === 'ready' ? openRequests(requests.requests, today) : [],
    events: events.kind === 'ready' ? weekEvents(events.data.events, today) : [],
  }
}
export type HomeExtras = ReturnType<typeof useHomeExtras>
