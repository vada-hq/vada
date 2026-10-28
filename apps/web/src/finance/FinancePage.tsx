import type { Action, CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useAddressRecord } from '@/lib/use-address-record'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import type { ClosingOpeners } from './ClosingChecks'
import { ClosingTab } from './ClosingTab'
import { ExpenseDialogs } from './ExpenseDialogs'
import { ExpenseBrowser } from './ExpenseBrowser'
import { IncomesTab } from './IncomesTab'
import { LedgerKind } from './LedgerKind'
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

// 행사 정산 읽기는 기간 결산의 초안 읽기 권한·불러오기 상태와 독립이다(메뉴 v7 설계 안 B).
function ManagedTab({
  tab,
  view,
  onForbidden,
  openers,
}: {
  tab: 'overview' | 'accounts' | 'closing'
  view: CouncilView
  onForbidden: () => void
  openers: ClosingOpeners
}) {
  const shared = { councilId: view.council.id, onForbidden }
  const canManage = view.permissions.includes('finance.manage')
  if (tab === 'overview') return <OverviewTab {...shared} canManage={canManage} />
  if (tab === 'closing')
    return (
      <div className="flex flex-col gap-6">
        <section aria-label="행사 정산" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold break-keep wrap-anywhere">행사 정산</h2>
          <SettlementsTab {...shared} />
        </section>
        <section aria-label="기간 결산" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold break-keep wrap-anywhere">기간 결산</h2>
          <ClosingTab
            {...shared}
            canManage={canManage}
            canReadDraft={view.permissions.includes('closing.view_draft')}
            openers={openers}
          />
        </section>
      </div>
    )
  return null
}

function FinanceTabPanel({
  tab,
  expenses,
  view,
  openers,
  onForbidden,
  income,
}: {
  tab: FinanceTab
  income: boolean
  expenses: ExpenseList
  view: CouncilView
  openers: ClosingOpeners
  onForbidden: () => void
}) {
  return (
    <div role="tabpanel" className="flex flex-col gap-3">
      {tab === 'ledger' ? (
        income ? (
          <IncomesTab
            councilId={view.council.id}
            canManage={view.permissions.includes('finance.manage')}
            onForbidden={onForbidden}
          />
        ) : (
          <ExpenseBrowser
            councilId={view.council.id}
            list={expenses}
            onOpen={openers.onOpenExpense}
            onForbidden={onForbidden}
          />
        )
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
  const { tab, setTab, income, setKind } = useFinanceControls(councilId)
  const expenseDialogs = useRecordDialogs(useAddressRecord('expenses', councilId))
  // 지출 목록은 지출 탭이 열려 있을 때만 읽는다.
  const expenses = useExpenses(councilId, props.onForbidden, tab === 'ledger' && !income)
  return (
    <PageColumn>
      <ExpenseDialogs
        view={props.view}
        dialogs={expenseDialogs}
        onChanged={() => void expenses.reload()}
        onForbidden={props.onForbidden}
      />
      <FinanceTabs tab={tab} onTab={setTab} />
      {tab === 'ledger' && <LedgerKind income={income} onChange={setKind} />}
      <CreateRow
        lost={expenseDialogs.lost}
        onCreateExpense={
          tab === 'ledger' && !income && can('finance.manage') ? expenseDialogs.startCreate : null
        }
      />
      <FinanceTabPanel
        tab={tab}
        income={income}
        expenses={expenses}
        view={props.view}
        openers={financeOpeners(councilId)}
        onForbidden={props.onForbidden}
      />
    </PageColumn>
  )
}
