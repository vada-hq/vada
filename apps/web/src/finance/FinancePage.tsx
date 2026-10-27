import type { Action, CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useAddressRecord } from '@/lib/use-address-record'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { BudgetTab } from './BudgetTab'
import type { ClosingOpeners } from './ClosingChecks'
import { ClosingTab } from './ClosingTab'
import { ExpenseDialogs } from './ExpenseDialogs'
import { ExpenseBrowser } from './ExpenseBrowser'
import { FeePaymentsTab } from './FeePaymentsTab'
import { IncomesTab } from './IncomesTab'
import { OverviewTab } from './OverviewTab'
import { financeOpeners } from './finance-openers'
import { FinanceTabs, type FinanceTab } from './FinanceTabs'
import { SettlementsTab } from './SettlementsTab'
import { useExpenses, type ExpenseList } from './useExpenses'
import { useFinanceControls } from './useFinanceQuery'

type Props = {
  view: CouncilView
  onForbidden: () => void
}

// 재정부가 고치는 탭과 모두가 보는 개요. 보는 것은 탭마다 정한 권한이 가른다.
function ManagedTab({
  tab,
  view,
  onForbidden,
  openers,
}: {
  tab: 'overview' | 'fees' | 'accounts' | 'budget' | 'incomes' | 'closing'
  view: CouncilView
  onForbidden: () => void
  openers: ClosingOpeners
}) {
  const shared = { councilId: view.council.id, onForbidden }
  const canManage = view.permissions.includes('finance.manage')
  if (tab === 'overview') return <OverviewTab {...shared} canManage={canManage} />
  if (tab === 'fees')
    return (
      <FeePaymentsTab {...shared} canManage={view.permissions.includes('fee_payment.manage')} />
    )
  if (tab === 'incomes') return <IncomesTab {...shared} canManage={canManage} />
  if (tab === 'closing') return <ClosingTab {...shared} canManage={canManage} openers={openers} />
  return tab === 'accounts' ? null : <BudgetTab {...shared} canManage={canManage} />
}

function FinanceTabPanel({
  tab,
  expenses,
  view,
  openers,
  onForbidden,
}: {
  tab: Exclude<FinanceTab, 'requests'>
  expenses: ExpenseList
  view: CouncilView
  openers: ClosingOpeners
  onForbidden: () => void
}) {
  return (
    <div role="tabpanel" className="flex flex-col gap-3">
      {tab === 'expenses' ? (
        <ExpenseBrowser
          councilId={view.council.id}
          list={expenses}
          onOpen={openers.onOpenExpense}
          onForbidden={onForbidden}
        />
      ) : tab === 'settlements' ? (
        <SettlementsTab councilId={view.council.id} onForbidden={onForbidden} />
      ) : (
        <ManagedTab tab={tab} view={view} onForbidden={onForbidden} openers={openers} />
      )}
    </div>
  )
}

// 지출 적기 버튼과, 열려 있던 지출을 잃었을 때의 이유(좁은 화면에서도 버튼 바로 옆에 보인다).
function CreateRow({
  lost,
  onCreateExpense,
}: {
  lost: string | null
  // 재정부에게만, 지출 탭에서만 있다.
  onCreateExpense: (() => void) | null
}) {
  if (!onCreateExpense && !lost) return null
  return (
    <div className="flex flex-wrap items-center gap-3">
      {onCreateExpense && (
        <Button variant="outline" onClick={onCreateExpense}>
          지출 적기
        </Button>
      )}
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
    </div>
  )
}

// 재정 탭과 지출 상세는 주소를 읽고, 구매는 구매 메뉴가 맡는다.
export default function FinancePage(props: Props) {
  const councilId = props.view.council.id
  const can = (action: Action) => props.view.permissions.includes(action)
  const access = { fees: can('fee_payment.view') }
  const { tab, setTab } = useFinanceControls(councilId, access)
  const expenseDialogs = useRecordDialogs(useAddressRecord('expenses', councilId))
  // 지출 목록은 지출 탭이 열려 있을 때만 읽는다.
  const expenses = useExpenses(councilId, props.onForbidden, tab === 'expenses')
  return (
    <PageColumn>
      <CreateRow
        lost={expenseDialogs.lost}
        onCreateExpense={
          tab === 'expenses' && can('finance.manage') ? expenseDialogs.startCreate : null
        }
      />
      <ExpenseDialogs
        view={props.view}
        dialogs={expenseDialogs}
        onChanged={() => void expenses.reload()}
        onForbidden={props.onForbidden}
      />
      <FinanceTabs tab={tab} onTab={setTab} showFees={access.fees} />
      <FinanceTabPanel
        tab={tab}
        expenses={expenses}
        view={props.view}
        openers={financeOpeners(councilId)}
        onForbidden={props.onForbidden}
      />
    </PageColumn>
  )
}
