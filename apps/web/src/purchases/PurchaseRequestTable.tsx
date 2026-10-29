import type { PurchaseRequestSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { wonLabel } from '@/finance/purchase-view'
import { dayLabel } from '@/lib/korean-date-text'
import { cn } from '@/lib/utils'
import { requestStateLabel } from './purchase-board'

type Variant = 'records' | 'mine'
type Props = {
  requests: PurchaseRequestSummary[]
  // records: 재정부 기록의 요청 단위 표(EVT-FIN-01B), mine: 내 구매 요청 표(MY-REQ-01)
  variant: Variant
  onOpen: (requestId: string) => void
}

const HEADS: Record<Variant, string[]> = {
  records: ['요청일', '구매 요청명', '요청 부서', '전체 요청액', '현재 상태'],
  mine: ['요청 제목', '요청액', '품목 수', '요청일', '필요한 날짜', '상태'],
}
// 금액·수 칸은 오른쪽, 상태는 가운데로 맞춘다.
const ALIGN: Record<string, string> = {
  '전체 요청액': 'text-right',
  요청액: 'text-right',
  '품목 수': 'text-center',
  '현재 상태': 'text-center',
  상태: 'text-center',
}

// 배송비를 모르면 상품 값만 있다는 것을 같이 적는다(합계로 읽히지 않게).
function amountText(request: PurchaseRequestSummary) {
  const estimate = request.estimate
  if (estimate?.total != null) return wonLabel(estimate.total)
  if (estimate?.subtotal != null) return `상품 ${wonLabel(estimate.subtotal)} · 배송비 미확인`
  return '미정'
}

// 줄을 누르면 그 구매 요청이 열린다(줄 전체가 제목 단추 하나).
export function PurchaseRequestTable({ requests, variant, onOpen }: Props) {
  return (
    <div className={cn(cardClass, 'overflow-x-auto')}>
      <table className="w-full min-w-180 text-sm">
        <thead className="border-b bg-surface-subtle text-xs text-fg-muted">
          <tr>
            {HEADS[variant].map(head => (
              <th
                key={head}
                scope="col"
                className={cn('px-4 py-3 text-left font-medium', ALIGN[head])}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {requests.map(request => (
            <tr key={request.id} className={cn(rowLinkBox, 'hover:bg-surface-subtle')}>
              {variant === 'records' ? (
                <RecordCells request={request} onOpen={onOpen} />
              ) : (
                <MineCells request={request} onOpen={onOpen} />
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Title({ request, onOpen }: { request: PurchaseRequestSummary; onOpen: Props['onOpen'] }) {
  return (
    <Button
      variant="link"
      className={cn(
        rowLinkTarget,
        'h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal text-fg wrap-anywhere no-underline hover:no-underline',
      )}
      onClick={() => onOpen(request.id)}
    >
      {request.title}
    </Button>
  )
}

function StateBadge({ request }: { request: PurchaseRequestSummary }) {
  const state = requestStateLabel(request)
  return <Badge tone={state.tone}>{state.label}</Badge>
}

function Amount({ request }: { request: PurchaseRequestSummary }) {
  return <>{amountText(request)}</>
}

function RecordCells({
  request,
  onOpen,
}: {
  request: PurchaseRequestSummary
  onOpen: Props['onOpen']
}) {
  return (
    <>
      <td className="px-4 py-3 text-fg-muted tabular-nums">{dayLabel(request.createdAt)}</td>
      <td className="px-4 py-3">
        <Title request={request} onOpen={onOpen} />
      </td>
      <td className="px-4 py-3 text-fg-secondary">
        {request.requesterDepartments?.join(', ') || request.requestedBy.name}
      </td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums">
        <Amount request={request} />
      </td>
      <td className="px-4 py-3 text-center">
        <StateBadge request={request} />
      </td>
    </>
  )
}

function MineCells({
  request,
  onOpen,
}: {
  request: PurchaseRequestSummary
  onOpen: Props['onOpen']
}) {
  return (
    <>
      <td className="px-4 py-3">
        <Title request={request} onOpen={onOpen} />
        {request.bodyPreview && (
          <p className="line-clamp-1 text-xs text-fg-muted">{request.bodyPreview}</p>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        <Amount request={request} />
      </td>
      <td className="px-4 py-3 text-center text-fg-secondary tabular-nums">
        {request.itemCount}종
      </td>
      <td className="px-4 py-3 text-fg-secondary tabular-nums">{dayLabel(request.createdAt)}</td>
      <td className="px-4 py-3 text-fg-secondary tabular-nums">
        {request.neededBy ? dayLabel(request.neededBy) : '-'}
      </td>
      <td className="px-4 py-3 text-center">
        <StateBadge request={request} />
      </td>
    </>
  )
}
