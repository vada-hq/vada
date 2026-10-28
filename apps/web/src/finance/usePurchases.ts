import { statusOf, type PurchaseRequestsResponse, type PurchaseView } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { purchasesPath } from './finance-api'

type Loaded =
  | { kind: 'failed' }
  | { kind: 'ready'; requests: PurchaseRequestsResponse['requests']; truncated: boolean }
type PurchasesState = { kind: 'loading' } | Loaded

// 구매 요청 목록 하나(보기·행사 범위). 화면이 보이는 동안 15초마다, 화면이 다시 보일 때, 알림이 올 때 다시 읽는다.
// 보기를 바꾸면 이전 보기의 늦은 응답은 버린다. 읽다 실패해도 보이던 목록은 그대로 둔다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function usePurchases(
  councilId: string,
  view: PurchaseView,
  onForbidden: () => void,
  options: boolean | { event: string | undefined } = true,
) {
  const read = usePolledRead<PurchaseRequestsResponse>(
    purchasesPath(councilId, view, typeof options === 'boolean' ? undefined : options.event),
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
    typeof options === 'boolean' ? options : true,
  )
  const state: PurchasesState =
    read.state.kind === 'ready' ? { kind: 'ready', ...read.state.data } : read.state
  return { state, reload: read.reload }
}
export type PurchaseList = ReturnType<typeof usePurchases>
