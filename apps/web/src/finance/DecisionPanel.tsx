import type { BudgetItemView, PurchaseLineItem } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { BUDGET_LOAD_FAILED } from '@/lib/messages'
import { expenseItems } from './budget-form'
import { DecisionRow } from './DecisionRow'
import { useDecisionRows } from './use-decision-rows'
import { useBudget, type BudgetState } from './useBudget'
import type { useDecide } from './useDecide'

type Decide = ReturnType<typeof useDecide>

type Props = {
  councilId: string
  items: PurchaseLineItem[]
  decide: Decide
  onForbidden: () => void
  // 기간이나 항목이 없을 때 예산 탭으로 데려간다. 갈 곳이 없는 화면(행사의 예산·정산 탭)은 주지 않고 버튼이 없다.
  onOpenBudget?: (() => void) | undefined
}

// 결재할 예산이 없다: 기간이 없거나 항목이 하나도 없다.
function NeedsBudget({
  hasPeriod,
  onOpenBudget,
}: {
  hasPeriod: boolean
  onOpenBudget: (() => void) | undefined
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert tone="warning">
        {hasPeriod ? '지출 예산 항목을 먼저 더해 주세요.' : '회계 기간을 먼저 만들어 주세요.'}
      </Alert>
      {onOpenBudget && (
        <Button variant="outline" size="sm" onClick={onOpenBudget}>
          예산 탭으로 가기
        </Button>
      )}
    </div>
  )
}

function Rows({
  councilId,
  items,
  budgetItems,
  decide,
  onInvalidItem,
}: {
  councilId: string
  items: PurchaseLineItem[]
  budgetItems: readonly BudgetItemView[]
  decide: Decide
  onInvalidItem: () => void
}) {
  const { formRef, ...state } = useDecisionRows(councilId, budgetItems, decide, onInvalidItem)
  return (
    <div ref={formRef} className="flex flex-col gap-3">
      {items.map(item => (
        <DecisionRow
          key={item.id}
          item={item}
          values={state.rowOf(item.id)}
          chosen={state.chosenOf(item.id)}
          budgetItems={budgetItems}
          disabled={decide.saving}
          errors={state.errorsOf(item.id)}
          onChange={patch => state.change(item.id, patch)}
          onApprove={() => void state.submit('approve', [item])}
          onReject={() => void state.submit('reject', [item])}
        />
      ))}
      {items.length > 1 && (
        <Button
          className="self-start"
          disabled={decide.saving}
          onClick={() => void state.submit('approve', items)}
        >
          모두 승인
        </Button>
      )}
      {decide.problem && <StateMessage kind="error">{decide.problem}</StateMessage>}
    </div>
  )
}

function Body({
  state,
  reload,
  ...rest
}: Omit<Props, 'onForbidden'> & { state: BudgetState; reload: () => void }) {
  if (state.kind === 'loading') return <StateMessage kind="loading">예산 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{BUDGET_LOAD_FAILED}</StateMessage>
        <Button variant="outline" size="sm" onClick={reload}>
          다시 시도
        </Button>
      </div>
    )
  const { period } = state.budget
  const items = expenseItems(state.budget.items)
  if (!period || items.length === 0)
    return <NeedsBudget hasPeriod={period !== null} onOpenBudget={rest.onOpenBudget} />
  return (
    <Rows
      councilId={rest.councilId}
      items={rest.items}
      budgetItems={items}
      decide={rest.decide}
      onInvalidItem={reload}
    />
  )
}

// 요청 상세의 결재 칸(`purchase_request.decide`가 있을 때만 보인다). 대기 품목마다 금액과 예산 항목을 골라 승인하거나 사유를 적어 반려한다.
export function DecisionPanel({ items, onForbidden, ...rest }: Props) {
  const budget = useBudget(rest.councilId, onForbidden)
  const pending = items.filter(item => item.status === 'pending')
  if (pending.length === 0) return null
  return (
    <section aria-label="결재" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">결재</h3>
      <Body {...rest} items={pending} state={budget.state} reload={() => void budget.reload()} />
    </section>
  )
}
