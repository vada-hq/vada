import type { PurchaseLineItem } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { BUDGET_LOAD_FAILED } from '@/lib/budget-messages'
import { expenseItems, itemsForEvent } from './budget-form'
import { eventItemsFirst } from './decision-budget'
import { submitLabelOf, tallyText, type Tally } from './decision-form'
import { BudgetOverConfirm } from './BudgetOverConfirm'
import { DecisionRow } from './DecisionRow'
import { useDecisionRows, type DecisionRowsOptions } from './use-decision-rows'
import { useBudget, type BudgetState } from './useBudget'
import type { useDecide } from './useDecide'

type Decide = ReturnType<typeof useDecide>

type Props = {
  councilId: string
  items: PurchaseLineItem[]
  // 요청의 행사. 고르기 목록은 이 행사와 맞는 항목만 보인다.
  eventId: string | null
  decide: Decide
  onForbidden: () => void
  // 기간이나 항목이 없을 때 예산 탭으로 데려간다. 갈 곳이 없는 화면(행사의 재정 탭)은 주지 않고 버튼이 없다.
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

// 결재 줄들과 보내기 줄. API를 부르지 않아(보내기는 decide가 한다) 부품 확인 화면도 그대로 그린다.
export function DecisionRows(options: DecisionRowsOptions) {
  const { items, budgetItems, decide } = options
  const { formRef, ...state } = useDecisionRows(options)
  return (
    <div ref={formRef} className="flex flex-col gap-3">
      {items.map(item => (
        <DecisionRow
          key={item.id}
          item={item}
          values={state.rowOf(item.id)}
          chosen={state.chosenOf(item.id)}
          budgetItems={budgetItems}
          overages={state.overages}
          disabled={decide.saving}
          errors={state.errorsOf(item.id)}
          onChange={patch => state.change(item.id, patch)}
        />
      ))}
      <SubmitBar
        tally={state.tally}
        showTally={items.length > 1}
        unreviewedShown={state.unreviewedShown}
        busy={decide.saving}
        onSubmit={state.submit}
      />
      {decide.problem && <StateMessage kind="error">{decide.problem}</StateMessage>}
      <BudgetOverConfirm
        open={state.confirming}
        lines={state.overages.map(over => ({ ...over, available: over.after }))}
        when="승인하면"
        confirmLabel="그래도 승인"
        busy={decide.saving}
        error={null}
        onConfirm={state.confirm}
        onClose={state.cancelConfirm}
      />
    </div>
  )
}

// 보내기 줄(와이어프레임 FIN-REV-01 아래 줄): 고른 수, 고르지 않은 품목이 남았다는 글, 고른 조합을 따르는 버튼 하나.
function SubmitBar({
  tally,
  showTally,
  unreviewedShown,
  busy,
  onSubmit,
}: {
  tally: Tally
  // 품목이 하나면 버튼 이름이 곧 고른 것이라 수를 보이지 않는다.
  showTally: boolean
  unreviewedShown: boolean
  busy: boolean
  onSubmit: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t pt-3">
      {showTally && <span className="text-xs text-gray-500">{tallyText(tally)}</span>}
      {unreviewedShown && tally.unreviewed > 0 && (
        <span role="alert" className="text-xs text-red-600">
          미검토 품목이 {tally.unreviewed}개 있어요
        </span>
      )}
      <Button busy={busy} onClick={onSubmit}>
        {submitLabelOf(tally)}
      </Button>
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
  const items = eventItemsFirst(
    itemsForEvent(expenseItems(state.budget.items), rest.eventId),
    rest.eventId,
  )
  if (!period || items.length === 0)
    return <NeedsBudget hasPeriod={period !== null} onOpenBudget={rest.onOpenBudget} />
  return (
    <DecisionRows
      councilId={rest.councilId}
      items={rest.items}
      budgetItems={items}
      decide={rest.decide}
      onInvalidItem={reload}
    />
  )
}

// 요청 상세의 결재 칸(`purchase_request.decide`가 있을 때만 보인다). 대기 품목마다 승인(금액과 예산 항목)이나 반려(사유)를
// 고른 뒤 한 번에 보낸다(DEC-92, 와이어프레임 FIN-REV-01 '품목별 검토').
export function DecisionPanel({ items, onForbidden, ...rest }: Props) {
  const budget = useBudget(rest.councilId, onForbidden)
  const pending = items.filter(item => item.status === 'pending')
  if (pending.length === 0) return null
  return (
    <section aria-label="결재" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">
        결재 <span className="font-normal text-gray-500">{pending.length}건</span>
      </h3>
      <Body {...rest} items={pending} state={budget.state} reload={() => void budget.reload()} />
    </section>
  )
}
