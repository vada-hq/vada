import { useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react'
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
import type { FieldErrors } from '@/lib/use-form-check'
import { usePolledRead, type PolledState } from '@/lib/use-polled-read'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { purchasePath, purchasesPath } from './finance-api'
import {
  linkedRequestOf,
  setLineAmount,
  toggleLine,
  withRequest,
  withRequestReason,
  type ExpenseValues,
} from './expense-form'
import { wonLabel } from './purchase-view'

type Common = {
  councilId: string
  values: ExpenseValues
  disabled: boolean
  onChange: Dispatch<SetStateAction<ExpenseValues>>
  // 화면이 저절로 바꾸는 값(골라 두기, 사유 채우기, 결제할 수 없게 된 것 비우기). 사람이 손대기 전이면 떠날 때 묻지 않는다.
  onAuto: Dispatch<SetStateAction<ExpenseValues>>
  onForbidden: () => void
}

// 결제할 수 있는 품목이 하나라도 있다고 서버가 한(payable) 요청만 고른다. 품목 하나가 승인되고 다른 품목이 대기여도 요청 상태는 대기라서 상태로는 가를 수 없다.
const payable = (requests: PurchaseRequestsResponse['requests']) =>
  requests.filter(request => request.payable)

function loadingOr<T>(state: PolledState<T>, show: (data: T) => ReactNode): ReactNode {
  if (state.kind === 'ready') return show(state.data)
  return (
    <StateMessage kind={state.kind === 'failed' ? 'error' : 'loading'}>
      {state.kind === 'failed' ? EXPENSE_OPTIONS_FAILED : '불러오는 중이에요'}
    </StateMessage>
  )
}

const LINES_ERROR_ID = 'expense-lines-error'

function ItemRow({
  item,
  line,
  disabled,
  invalid,
  error,
  onToggle,
  onAmount,
}: {
  item: PurchaseLineItem
  line: ExpenseValues['lines'][number] | undefined
  disabled: boolean
  // 품목을 하나도 고르지 않았을 때 첫 줄의 체크박스에 문제를 단다. 누르면 그리로 옮긴다.
  invalid: boolean
  // 결제 금액의 문제
  error: string | undefined
  onToggle: () => void
  onAmount: (amount: string) => void
}) {
  const errorId = `${item.id}-amount-error`
  return (
    <li className="flex flex-col gap-2 rounded-sm border p-3">
      <Label className="flex items-center gap-2 text-sm max-sm:min-h-11">
        <input
          type="checkbox"
          className="size-4 accent-primary-emphasis"
          checked={line !== undefined}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? LINES_ERROR_ID : undefined}
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
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={event => onAmount(event.target.value)}
          />
        </Label>
      )}
      {line && error && (
        <p id={errorId} className="text-xs text-danger-emphasis">
          {error}
        </p>
      )}
    </li>
  )
}

// 계약은 고른 품목(lines)을 고른 차례로 센다. 그래서 품목의 차례를 찾아 그 줄의 결제 금액 문제를 고른다.
function lineError(values: ExpenseValues, errors: FieldErrors, lineItemId: string) {
  const index = values.lines.findIndex(line => line.lineItemId === lineItemId)
  return index === -1 ? undefined : errors[`lines.${index}.amount`]
}

export function ExpensePaymentItems({
  items,
  values,
  disabled,
  errors,
  onChange,
}: {
  items: PurchaseLineItem[]
  values: ExpenseValues
  disabled: boolean
  errors: FieldErrors
  onChange: (values: ExpenseValues) => void
}) {
  return (
    <ul aria-label="결제할 품목" className="flex flex-col gap-2">
      {items.map((item, index) => (
        <ItemRow
          key={item.id}
          item={item}
          line={values.lines.find(line => line.lineItemId === item.id)}
          disabled={disabled}
          invalid={index === 0 && errors.lines !== undefined}
          error={lineError(values, errors, item.id)}
          onToggle={() => onChange(toggleLine(values, item))}
          onAmount={amount => onChange(setLineAmount(values, item.id, amount))}
        />
      ))}
    </ul>
  )
}

// 고른 요청의 승인된 품목. 품목을 고르면 결제 금액이 승인 금액으로 채워지고, 고른 금액의 합이 지출 금액이 된다.
function ItemPicker({
  councilId,
  requestId,
  values,
  disabled,
  errors,
  onChange,
  onAuto,
}: Common & { requestId: string; errors: FieldErrors }) {
  const detail = usePolledRead<PurchaseRequestResponse>(
    purchasePath(councilId, requestId),
    () => {},
  )
  // 다시 읽은 상세에서 고른 품목이 결제할 수 없게 됐으면(취소, 행사 완료) 줄을 비워 숨은 줄이 몰래 나가지 않게 한다.
  const request = detail.state.kind === 'ready' ? detail.state.data.request : null
  useEffect(() => {
    if (!request) return
    const payableIds = new Set(request.items.filter(item => item.payable).map(item => item.id))
    onAuto(before => {
      if (before.requestId !== request.id) return before
      const next = withRequestReason(before, request)
      const lines = next.lines.filter(line => payableIds.has(line.lineItemId))
      return lines.length === next.lines.length ? next : { ...next, lines }
    })
  }, [request, values.lines, values.auto.reason, onAuto])
  return loadingOr(detail.state, ({ request }) => {
    const items = request.items.filter(item => item.payable)
    if (items.length === 0)
      return <StateMessage kind="empty">결제할 수 있는 승인 품목 없음</StateMessage>
    return (
      <ExpensePaymentItems
        items={items}
        values={values}
        disabled={disabled}
        errors={errors}
        onChange={onChange}
      />
    )
  })
}

// 메시지에서 열었으면 그 메시지에 연결된 요청을 사람이 고른 것처럼 골라 둔다(이미 아는 것을 다시 묻지 않는다).
// 목록을 처음 읽었을 때 한 번만 하고 onLinkedUsed로 알려, 창이 다시 주지 않게 한다(사람이 바꾸거나 푼 것을 되돌리지 않게).
function usePreselect(
  requests: PurchaseRequestsResponse['requests'] | null,
  linkedRequestIds: readonly string[] | undefined,
  { onAuto, onLinkedUsed }: Pick<LinkedProps, 'onAuto' | 'onLinkedUsed'>,
) {
  useEffect(() => {
    if (requests === null || linkedRequestIds === undefined) return
    onLinkedUsed()
    const linked = linkedRequestOf(payable(requests), linkedRequestIds)
    if (linked) onAuto(before => (before.requestId === null ? withRequest(before, linked) : before))
  }, [requests, linkedRequestIds, onAuto, onLinkedUsed])
}

type LinkedProps = Common & {
  // 메시지에 연결된 요청들. 아직 골라 두지 않았을 때만 있다.
  linkedRequestIds?: readonly string[] | undefined
  onLinkedUsed: () => void
}

// 요청한 품목 결제: 요청을 고르고, 그 요청의 승인된 품목을 고른다. 요청을 바꾸면 고른 품목은 비운다.
export function ExpenseRequestFields({
  errors,
  linkedRequestIds,
  onLinkedUsed,
  ...props
}: LinkedProps & { errors: FieldErrors }) {
  const { councilId, values, disabled, onChange, onAuto, onForbidden } = props
  const list = usePolledRead<PurchaseRequestsResponse>(purchasesPath(councilId, 'all'), status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
  // 다시 읽은 목록에서 고른 요청이 결제할 수 없게 됐으면(취소, 행사 완료) 요청과 품목을 비운다.
  const requests = list.state.kind === 'ready' ? list.state.data.requests : null
  const gone =
    requests !== null &&
    values.requestId !== null &&
    !payable(requests).some(request => request.id === values.requestId)
  useEffect(() => {
    if (gone) onAuto(withRequest(values, null))
  }, [gone, values, requests, onAuto])
  usePreselect(requests, linkedRequestIds, { onAuto, onLinkedUsed })
  return loadingOr(list.state, ({ requests }) => (
    <>
      <ChoiceSelect
        label="결제할 요청"
        required
        error={errors.requestId}
        choices={[
          { id: null, label: '요청 선택' },
          ...payable(requests).map(request => ({ id: request.id, label: request.title })),
        ]}
        value={values.requestId}
        disabled={disabled}
        onChange={requestId =>
          onChange(withRequest(values, requests.find(request => request.id === requestId) ?? null))
        }
      />
      {values.requestId && <ItemPicker {...props} requestId={values.requestId} errors={errors} />}
      {errors.lines && (
        <p id={LINES_ERROR_ID} className="text-xs text-danger-emphasis">
          {errors.lines}
        </p>
      )}
    </>
  ))
}
