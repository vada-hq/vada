import type { ReactNode } from 'react'
import {
  statusOf,
  type PurchaseLineItem,
  type PurchaseRequestResponse,
  type PurchaseRequestsResponse,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EXPENSE_OPTIONS_FAILED } from '@/lib/messages'
import { usePolledRead, type PolledState } from '@/lib/use-polled-read'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { purchasePath, purchasesPath } from './finance-api'
import { setLineAmount, toggleLine, type ExpenseValues } from './expense-form'
import { wonLabel } from './purchase-view'

type Common = {
  councilId: string
  values: ExpenseValues
  disabled: boolean
  onChange: (values: ExpenseValues) => void
  onForbidden: () => void
}

// 승인된 품목이 하나라도 있을 수 있는 요청이다. 품목 하나가 승인되고 다른 품목이 대기면 요청 상태는 대기라서
// 취소·반려된 요청만 빼고, 승인된 품목은 요청을 골라 품목을 읽은 뒤에 가린다. 서버가 승인 안 된 품목은 다시 거절한다.
const payable = (requests: PurchaseRequestsResponse['requests']) =>
  requests.filter(request => request.status !== 'cancelled' && request.status !== 'rejected')

function loadingOr<T>(state: PolledState<T>, show: (data: T) => ReactNode): ReactNode {
  if (state.kind === 'ready') return show(state.data)
  return (
    <StateMessage kind={state.kind === 'failed' ? 'error' : 'loading'}>
      {state.kind === 'failed' ? EXPENSE_OPTIONS_FAILED : '불러오는 중이에요'}
    </StateMessage>
  )
}

function ItemRow({
  item,
  line,
  disabled,
  onToggle,
  onAmount,
}: {
  item: PurchaseLineItem
  line: ExpenseValues['lines'][number] | undefined
  disabled: boolean
  onToggle: () => void
  onAmount: (amount: string) => void
}) {
  return (
    <li className="flex flex-col gap-2 rounded-sm border p-3">
      <Label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-blue-600"
          checked={line !== undefined}
          disabled={disabled}
          onChange={onToggle}
        />
        <span className="min-w-0 flex-1 wrap-anywhere">
          {item.name} · 승인 {wonLabel(item.amount ?? 0)}
        </span>
        {item.paid && <Badge tone="success">결제함</Badge>}
      </Label>
      {line && (
        <Label className="flex flex-col gap-2">
          {item.name} 결제 금액
          <Input
            inputMode="numeric"
            value={line.amount}
            disabled={disabled}
            onChange={event => onAmount(event.target.value)}
          />
        </Label>
      )}
    </li>
  )
}

// 고른 요청의 승인된 품목. 품목을 고르면 결제 금액이 승인 금액으로 채워지고, 고른 금액의 합이 지출 금액이 된다.
function ItemPicker({
  councilId,
  requestId,
  values,
  disabled,
  onChange,
}: Common & { requestId: string }) {
  const detail = usePolledRead<PurchaseRequestResponse>(
    purchasePath(councilId, requestId),
    () => {},
  )
  return loadingOr(detail.state, ({ request }) => {
    const items = request.items.filter(item => item.status === 'approved')
    if (items.length === 0)
      return <StateMessage kind="empty">결제할 수 있는 승인된 품목이 없어요.</StateMessage>
    return (
      <ul aria-label="결제할 품목" className="flex flex-col gap-2">
        {items.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            line={values.lines.find(line => line.lineItemId === item.id)}
            disabled={disabled}
            onToggle={() => onChange(toggleLine(values, item))}
            onAmount={amount => onChange(setLineAmount(values, item.id, amount))}
          />
        ))}
      </ul>
    )
  })
}

// 요청한 품목 결제: 요청을 고르고, 그 요청의 승인된 품목을 고른다. 요청을 바꾸면 고른 품목은 비운다.
export function ExpenseRequestFields(props: Common) {
  const { councilId, values, disabled, onChange, onForbidden } = props
  const list = usePolledRead<PurchaseRequestsResponse>(purchasesPath(councilId, 'all'), status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
  return loadingOr(list.state, ({ requests }) => (
    <>
      <ChoiceSelect
        label="결제할 요청"
        choices={[
          { id: null, label: '요청을 고르세요' },
          ...payable(requests).map(request => ({ id: request.id, label: request.title })),
        ]}
        value={values.requestId}
        disabled={disabled}
        onChange={requestId => onChange({ ...values, requestId, lines: [] })}
      />
      {values.requestId && <ItemPicker {...props} requestId={values.requestId} />}
    </>
  ))
}
