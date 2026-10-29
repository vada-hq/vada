import { usePurchases } from '@/finance/usePurchases'
import { mergedList } from './purchase-board'

// 구매 보드가 읽는 요청. 처리 단계면 결재 대기 목록도 함께 읽어 합친다(purchase-board.ts mergedList).
export function useBoardRequests(
  councilId: string,
  board: { board: string; page: string | null; fetchView: Parameters<typeof usePurchases>[1] },
  onForbidden: () => void,
  event: string | undefined,
) {
  const withPending = board.board === 'process' && board.page === null
  const main = usePurchases(councilId, board.fetchView, onForbidden, { event })
  const pending = usePurchases(councilId, 'pending', onForbidden, { event, enabled: withPending })
  return mergedList(main, withPending ? pending : null)
}
