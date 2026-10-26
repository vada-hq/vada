import {
  PURCHASE_PENDING_LIMIT,
  PURCHASE_RECENT_LIMIT,
  type Action,
  type CouncilView,
  type PurchaseView,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openMenu, openRecord } from '@/lib/go-to'
import { PURCHASES_LOAD_FAILED } from '@/lib/messages'
import { useAddressRecord } from '@/lib/use-address-record'
import { useNow } from '@/lib/use-now'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { AccountsTab } from './AccountsTab'
import { BudgetTab } from './BudgetTab'
import type { ClosingOpeners } from './ClosingChecks'
import { ClosingTab } from './ClosingTab'
import { ExpenseDialogs } from './ExpenseDialogs'
import { ExpensesPanel } from './ExpensesPanel'
import { FeePaymentsTab } from './FeePaymentsTab'
import { IncomesTab } from './IncomesTab'
import { OverviewTab } from './OverviewTab'
import { financeOpeners } from './finance-openers'
import { FinanceTabs, RequestFilter, type FinanceTab } from './FinanceTabs'
import { neededSoon, VIEW_EMPTY } from './purchase-view'
import RequestCard from './RequestCard'
import { SettlementsTab } from './SettlementsTab'
import { RequestCreateDialog } from './RequestCreateDialog'
import { RequestDetailDialog } from './RequestDetailDialog'
import { useExpenses, type ExpenseList } from './useExpenses'
import { useFinanceControls } from './useFinanceQuery'
import { usePurchases, type PurchaseList } from './usePurchases'

const overflow = (view: PurchaseView) =>
  `요청이 많아서 ${view === 'pending' ? PURCHASE_PENDING_LIMIT : PURCHASE_RECENT_LIMIT}개만 보여요.`

type Props = {
  view: CouncilView
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다. 운영진이 아니게 되었으면 학생회를 닫는다.
  onForbidden: () => void
}

function Body({
  list,
  view,
  onOpen,
}: {
  list: PurchaseList
  view: PurchaseView
  onOpen: (requestId: string) => void
}) {
  const { state } = list
  const now = useNow()
  if (state.kind === 'loading')
    return <StateMessage kind="loading">구매 요청 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{PURCHASES_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  if (state.requests.length === 0)
    return <StateMessage kind="empty">{VIEW_EMPTY[view]}</StateMessage>
  return (
    <>
      <ul className="flex flex-col gap-2">
        {state.requests.map(request => (
          <li key={request.id}>
            <RequestCard
              request={request}
              soon={view === 'pending' && neededSoon(request.neededBy, now)}
              onOpen={() => onOpen(request.id)}
            />
          </li>
        ))}
      </ul>
      {state.truncated && <StateMessage kind="notice">{overflow(view)}</StateMessage>}
    </>
  )
}

// 재정부가 고치는 탭(개요, 납부자 명단, 계좌, 예산, 수입, 결산). 보는 것은 탭마다 정한 권한이 가른다.
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
  if (tab === 'overview')
    return (
      <OverviewTab
        {...shared}
        onOpenBudget={() => openMenu('finance', view.council.id, { tab: 'budget' })}
      />
    )
  if (tab === 'fees')
    return (
      <FeePaymentsTab {...shared} canManage={view.permissions.includes('fee_payment.manage')} />
    )
  const canManage = view.permissions.includes('finance.manage')
  if (tab === 'incomes') return <IncomesTab {...shared} canManage={canManage} />
  if (tab === 'closing') return <ClosingTab {...shared} canManage={canManage} openers={openers} />
  return tab === 'accounts' ? (
    <AccountsTab {...shared} canManage={canManage} />
  ) : (
    <BudgetTab {...shared} canManage={canManage} />
  )
}

function FinanceTabPanel({
  tab,
  filter,
  onFilter,
  list,
  expenses,
  view,
  openers,
  onForbidden,
}: {
  tab: FinanceTab
  filter: PurchaseView
  onFilter: (filter: PurchaseView) => void
  list: PurchaseList
  expenses: ExpenseList
  view: CouncilView
  openers: ClosingOpeners
  onForbidden: () => void
}) {
  return (
    <div role="tabpanel" className="flex flex-col gap-3">
      {tab === 'requests' ? (
        <>
          <RequestFilter view={filter} onView={onFilter} />
          <Body list={list} view={filter} onOpen={openers.onOpenRequest} />
        </>
      ) : tab === 'expenses' ? (
        <ExpensesPanel list={expenses} onOpen={openers.onOpenExpense} />
      ) : tab === 'settlements' ? (
        <SettlementsTab councilId={view.council.id} onForbidden={onForbidden} />
      ) : (
        <ManagedTab tab={tab} view={view} onForbidden={onForbidden} openers={openers} />
      )}
    </div>
  )
}

// 내기 버튼과, 열려 있던 요청을 잃었을 때의 이유(좁은 화면에서도 버튼 바로 옆에 보인다).
function CreateRow({
  lost,
  onCreate,
  onCreateExpense,
}: {
  lost: string | null
  onCreate: (() => void) | null
  // 재정부에게만, 지출 탭에서만 있다.
  onCreateExpense: (() => void) | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {onCreate && <Button onClick={onCreate}>구매 요청 내기</Button>}
      {onCreateExpense && (
        <Button variant="outline" onClick={onCreateExpense}>
          지출 적기
        </Button>
      )}
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
    </div>
  )
}

type Dialogs = ReturnType<typeof useRecordDialogs>

// 상세와 내기 대화상자. 바뀌면 목록과 수를 다시 읽고, 대상을 잃으면 이유를 보인다.
function RequestDialogs({
  councilId,
  dialogs,
  onChanged,
  onForbidden,
}: {
  councilId: string
  dialogs: Dialogs
  onChanged: () => void
  onForbidden: () => void
}) {
  const shared = {
    councilId,
    onForbidden,
    onLost: (message: string) => {
      dialogs.lose(message)
      onChanged()
    },
  }
  return (
    <>
      <RequestDetailDialog
        {...shared}
        requestId={dialogs.openId}
        onClose={dialogs.closeDetail}
        onChanged={onChanged}
        // 예산 탭은 요청 상세를 닫고 간다(창의 칸을 거둔 뒤 쌓아, 뒤로가 요청 목록이다).
        onOpenBudget={() => openMenu('finance', councilId, { tab: 'budget' })}
        // 지출은 이 요청 상세 위에 쌓아, 지출을 닫으면 이 요청으로 돌아온다.
        onOpenExpense={id => openRecord('expenses', councilId, id, { overRecord: true })}
      />
      <RequestCreateDialog
        {...shared}
        open={dialogs.creating}
        onClose={dialogs.closeCreate}
        onCreated={() => {
          onChanged()
          dialogs.closeCreate()
        }}
      />
    </>
  )
}

// 옆 메뉴 '재정': 재정부는 개요 탭, 나머지는 구매 요청 탭(거르기 셋: 내 요청, 결재 대기, 전체)으로 연다. 거르기를 바꾸면 이전 거르기의 늦은 응답은 버린다.
// 탭과 거르기는 주소가 원문이고, 요청·지출 상세는 그 종류의 주소로 연다. 납부자 명단이나 개요를 보던 중 권한을 잃으면(탭이 사라지면) 구매 요청으로 돌아간다.
export default function FinancePage(props: Props) {
  const councilId = props.view.council.id
  const can = (action: Action) => props.view.permissions.includes(action)
  const access = { fees: can('fee_payment.view'), overview: can('finance.manage') }
  const { tab, filter, setTab, setFilter } = useFinanceControls(councilId, access)
  const dialogs = useRecordDialogs(useAddressRecord('purchases', councilId))
  const expenseDialogs = useRecordDialogs(useAddressRecord('expenses', councilId))
  const list = usePurchases(councilId, filter, props.onForbidden)
  // 지출 목록은 지출 탭이 열려 있을 때만 읽는다.
  const expenses = useExpenses(councilId, props.onForbidden, tab === 'expenses')
  return (
    <PageColumn>
      <CreateRow
        lost={dialogs.lost ?? expenseDialogs.lost}
        onCreate={can('purchase.request') ? dialogs.startCreate : null}
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
      <RequestDialogs
        councilId={councilId}
        dialogs={dialogs}
        onChanged={() => void list.reload()}
        onForbidden={props.onForbidden}
      />
      <FinanceTabs tab={tab} onTab={setTab} showFees={access.fees} showOverview={access.overview} />
      <FinanceTabPanel
        tab={tab}
        filter={filter}
        onFilter={setFilter}
        list={list}
        expenses={expenses}
        view={props.view}
        openers={financeOpeners(councilId)}
        onForbidden={props.onForbidden}
      />
    </PageColumn>
  )
}
