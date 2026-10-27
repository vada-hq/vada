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
import { PURCHASES_LOAD_FAILED } from '@/lib/messages'
import { useAddressRecord } from '@/lib/use-address-record'
import { useNow } from '@/lib/use-now'
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
import { FinanceTabs, RequestFilter, type FinanceTab } from './FinanceTabs'
import { neededMarkOf, VIEW_EMPTY } from './purchase-view'
import RequestCard from './RequestCard'
import { SettlementsTab } from './SettlementsTab'
import { useExpenses, type ExpenseList } from './useExpenses'
import { useFinanceControls } from './useFinanceQuery'
import { usePurchases, type PurchaseList } from './usePurchases'
import { navigate, useHere } from '@/lib/app-location'
import { PurchasePage } from './PurchasePage'

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
  // 기기 시각이다. 목록 응답에 서버 시각이 없다(홈 응답에만 있다).
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
              mark={view === 'pending' ? neededMarkOf(request.neededBy, now) : null}
              onOpen={() => onOpen(request.id)}
            />
          </li>
        ))}
      </ul>
      {state.truncated && <StateMessage kind="notice">{overflow(view)}</StateMessage>}
    </>
  )
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
          <RequestFilter
            view={filter}
            onView={onFilter}
            hasHeads={view.me.departments.some(dept => dept.rank !== null)}
          />
          <Body list={list} view={filter} onOpen={openers.onOpenRequest} />
        </>
      ) : tab === 'expenses' ? (
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

// 옆 메뉴 '재정': 모든 운영진에게 개요 탭으로 연다(DEC-92). 구매 요청 탭의 거르기는 셋(내 요청, 결재 대기, 전체)이고, 바꾸면 이전 거르기의 늦은 응답은 버린다.
// 탭과 거르기는 주소가 원문이고, 요청·지출 상세는 그 종류의 주소로 연다. 납부자 명단을 보던 중 권한을 잃으면(탭이 사라지면) 개요로 돌아간다.
export default function FinancePage(props: Props) {
  const { location } = useHere()
  const active = location?.councilId === props.view.council.id.toLowerCase()
  if (active && location?.type === 'record' && location.record === 'purchases')
    return <PurchasePage {...props} requestId={location.recordId} />
  if (active && location?.type === 'menu' && location.query['compose'] === 'new')
    return <PurchasePage {...props} />
  return <FinanceList {...props} />
}

function FinanceList(props: Props) {
  const councilId = props.view.council.id
  const can = (action: Action) => props.view.permissions.includes(action)
  const access = { fees: can('fee_payment.view') }
  const { tab, filter, setTab, setFilter } = useFinanceControls(councilId, access)
  const expenseDialogs = useRecordDialogs(useAddressRecord('expenses', councilId))
  const list = usePurchases(councilId, filter, props.onForbidden)
  // 지출 목록은 지출 탭이 열려 있을 때만 읽는다.
  const expenses = useExpenses(councilId, props.onForbidden, tab === 'expenses')
  return (
    <PageColumn>
      <CreateRow
        lost={expenseDialogs.lost}
        onCreate={
          can('purchase.request') ? () => navigate(`/finance/${councilId}/requests/new`) : null
        }
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
