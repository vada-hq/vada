import { ArrowLeft, Plus } from 'lucide-react'
import type { PurchaseRequestSummary } from '@vada/contracts'
import type { PurchaseList } from '@/finance/usePurchases'
import { PURCHASES_LOAD_FAILED } from '@/lib/messages'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  REQUEST_STATES,
  REQUEST_STATE_TEXT,
  requestStateOf,
  type RequestState,
} from './purchase-board'
import { PurchaseRequestTable } from './PurchaseRequestTable'

type Props = {
  list: PurchaseList
  // 이름과 지금 부서
  who: string
  onBack: () => void
  onCreate: (() => void) | null
  onOpen: (requestId: string) => void
}

const VALUE_TONE: Record<RequestState, string> = {
  pending: 'text-primary-strong',
  revise: 'text-warning',
  approved: 'text-success',
  buying: 'text-primary-strong',
  done: 'text-fg-secondary',
  closed: 'text-danger',
}

// 내 구매 요청(와이어프레임 MY-REQ-01): 상태별 수와 요청 표.
export function MyPurchaseRequests({ list, who, onBack, onCreate, onOpen }: Props) {
  const requests = list.state.kind === 'ready' ? list.state.requests : []
  const counts = Object.fromEntries(
    REQUEST_STATES.map(state => [state, requests.filter(r => requestStateOf(r) === state).length]),
  ) as Record<RequestState, number>
  return (
    <section aria-label="내 구매 요청" className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
            <Button variant="ghost" size="icon" aria-label="구매로 돌아가기" onClick={onBack}>
              <ArrowLeft aria-hidden />
            </Button>
            내 구매 요청
          </h2>
          <p className="pl-10 text-xs text-fg-muted">{who}</p>
        </div>
        {onCreate && (
          <Button onClick={onCreate}>
            <Plus aria-hidden />새 구매 요청
          </Button>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {REQUEST_STATES.map(state => (
          <li key={state} className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
            <span className="text-xs text-fg-muted">{REQUEST_STATE_TEXT[state].label}</span>
            <span className={cn('text-2xl font-bold tabular-nums', VALUE_TONE[state])}>
              {counts[state]}
            </span>
          </li>
        ))}
      </ul>
      <MineBody list={list} requests={requests} onOpen={onOpen} />
    </section>
  )
}

function MineBody({
  list,
  requests,
  onOpen,
}: {
  list: PurchaseList
  requests: PurchaseRequestSummary[]
  onOpen: Props['onOpen']
}) {
  if (list.state.kind === 'loading')
    return <StateMessage kind="loading">구매 요청 불러오는 중…</StateMessage>
  if (list.state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{PURCHASES_LOAD_FAILED}</StateMessage>
        <Button touch variant="outline" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  if (requests.length === 0) return <StateMessage kind="empty">구매 요청 없음</StateMessage>
  return <PurchaseRequestTable requests={requests} variant="mine" onOpen={onOpen} />
}
