import type { ReactNode } from 'react'
import type { PurchaseLineItem } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { BUDGET_LOAD_FAILED } from '@/lib/budget-messages'
import { expenseItems, itemsForEvent } from './budget-form'
import { eventItemsFirst } from './decision-budget'
import { decidedText, submitLabelOf, type Tally } from './decision-form'
import { BudgetOverConfirm } from './BudgetOverConfirm'
import { DecisionRow, PendingItemCard } from './DecisionRow'
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
export function NeedsBudget({
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

// 보내기 줄(와이어프레임 FIN-REV-01 아래 줄): 고른 수 '승인 N · 반려 N · 미검토 N'과 고른 조합을 따르는 버튼 하나.
// 미검토가 남은 채 누르면 수의 '미검토 N'만 빨갛게 알린다(같은 수를 두 번 말하지 않는다).
function SubmitBar({
  tally,
  unreviewedShown,
  busy,
  onSubmit,
}: {
  tally: Tally
  unreviewedShown: boolean
  busy: boolean
  onSubmit: () => void
}) {
  const warn = unreviewedShown && tally.unreviewed > 0
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t pt-3">
      <span className="text-xs text-gray-500">
        {decidedText(tally)}
        {' · '}
        <span
          role={warn ? 'alert' : undefined}
          className={warn ? 'font-medium text-red-600' : undefined}
        >
          미검토 {tally.unreviewed}
        </span>
      </span>
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
  const waiting = (notice: ReactNode) => (
    <>
      {rest.items.map(item => (
        <PendingItemCard key={item.id} item={item} />
      ))}
      {notice}
    </>
  )
  if (state.kind === 'loading')
    return waiting(<StateMessage kind="loading">예산 불러오는 중…</StateMessage>)
  if (state.kind === 'failed')
    return waiting(
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{BUDGET_LOAD_FAILED}</StateMessage>
        <Button variant="outline" size="sm" onClick={reload}>
          다시 시도
        </Button>
      </div>,
    )
  const { period } = state.budget
  const items = eventItemsFirst(
    itemsForEvent(expenseItems(state.budget.items), rest.eventId),
    rest.eventId,
  )
  if (!period || items.length === 0)
    return waiting(<NeedsBudget hasPeriod={period !== null} onOpenBudget={rest.onOpenBudget} />)
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
    <DecisionFrame count={pending.length}>
      <Body {...rest} items={pending} state={budget.state} reload={() => void budget.reload()} />
    </DecisionFrame>
  )
}

// 결재 칸의 틀: 머리 '결재 N건'(와이어프레임 '품목별 검토 N건', 제품은 이 일을 '결재'로 부른다)과 품목들.
export function DecisionFrame({ count, children }: { count: number; children: ReactNode }) {
  return (
    <section aria-label="결재" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">
        결재 <span className="font-normal text-gray-500">{count}건</span>
      </h3>
      {children}
    </section>
  )
}
