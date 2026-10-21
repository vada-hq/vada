import { pendingCountOf } from './purchase-view'
import { usePurchases } from './usePurchases'

// 옆 메뉴 '재정'의 결재 대기 수. 재정부(결재 권한이 있는 사람)만 읽는다. 재정 화면이 목록을 바꾸면 pending.reload로 다시 읽는다.
export function usePendingCount(councilId: string, onForbidden: () => void, enabled: boolean) {
  const pending = usePurchases(councilId, 'pending', onForbidden, enabled)
  const { state } = pending
  // 결재 권한을 잃으면(enabled가 꺼지면) 이전에 읽은 값이 남아 있어도 수를 내지 않는다.
  const count =
    enabled && state.kind === 'ready' ? pendingCountOf(state.requests, state.truncated) : null
  return { pending, count }
}
