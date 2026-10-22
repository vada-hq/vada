import { useState } from 'react'
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
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { AccountsTab } from './AccountsTab'
import { BudgetTab } from './BudgetTab'
import { ExpenseDialogs } from './ExpenseDialogs'
import { ExpensesPanel } from './ExpensesPanel'
import { FeePaymentsTab } from './FeePaymentsTab'
import { IncomesTab } from './IncomesTab'
import { FinanceTabs, RequestFilter, type FinanceTab } from './FinanceTabs'
import { VIEW_EMPTY } from './purchase-view'
import RequestCard from './RequestCard'
import { RequestCreateDialog } from './RequestCreateDialog'
import { RequestDetailDialog } from './RequestDetailDialog'
import { useExpenses, type ExpenseList } from './useExpenses'
import { usePurchases, type PurchaseList } from './usePurchases'

const overflow = (view: PurchaseView) =>
  `요청이 많아서 ${view === 'pending' ? PURCHASE_PENDING_LIMIT : PURCHASE_RECENT_LIMIT}개만 보여요.`

type Props = {
  view: CouncilView
  // 알림으로 연 요청. 있으면 그 요청의 상세를 열고 시작한다.
  initialRequestId?: string | undefined
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다. 운영진이 아니게 되었으면 학생회를 닫는다.
  onForbidden: () => void
  // 목록이 바뀌었을 때(옆 메뉴의 결재 대기 수를 다시 읽는다).
  onChanged: () => void
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
            <RequestCard request={request} onOpen={() => onOpen(request.id)} />
          </li>
        ))}
      </ul>
      {state.truncated && <StateMessage kind="notice">{overflow(view)}</StateMessage>}
    </>
  )
}

// 재정부가 고치는 탭(납부자 명단, 계좌, 예산, 수입). 보는 것은 탭마다 정한 권한이 가른다.
function ManagedTab({
  tab,
  view,
  onForbidden,
}: {
  tab: 'fees' | 'accounts' | 'budget' | 'incomes'
  view: CouncilView
  onForbidden: () => void
}) {
  const shared = { councilId: view.council.id, onForbidden }
  if (tab === 'fees')
    return (
      <FeePaymentsTab {...shared} canManage={view.permissions.includes('fee_payment.manage')} />
    )
  const canManage = view.permissions.includes('finance.manage')
  if (tab === 'incomes') return <IncomesTab {...shared} canManage={canManage} />
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
  onOpen,
  onOpenExpense,
  onForbidden,
}: {
  tab: FinanceTab
  filter: PurchaseView
  onFilter: (filter: PurchaseView) => void
  list: PurchaseList
  expenses: ExpenseList
  view: CouncilView
  onOpen: (requestId: string) => void
  onOpenExpense: (expenseId: string) => void
  onForbidden: () => void
}) {
  return (
    <div role="tabpanel" className="flex flex-col gap-3">
      {tab === 'requests' ? (
        <>
          <RequestFilter view={filter} onView={onFilter} />
          <Body list={list} view={filter} onOpen={onOpen} />
        </>
      ) : tab === 'expenses' ? (
        <ExpensesPanel list={expenses} onOpen={onOpenExpense} />
      ) : (
        <ManagedTab tab={tab} view={view} onForbidden={onForbidden} />
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
  onOpenBudget,
  onOpenExpense,
}: {
  councilId: string
  dialogs: Dialogs
  onChanged: () => void
  onForbidden: () => void
  onOpenBudget: () => void
  onOpenExpense: (expenseId: string) => void
}) {
  const shared = {
    councilId,
    onForbidden,
    onLost: (message: string) => {
      dialogs.lose(message)
      onChanged()
    },
  }
  // 다른 화면으로 가기 전에 요청 상세를 닫는다.
  const leave = (go: () => void) => {
    dialogs.closeDetail()
    go()
  }
  return (
    <>
      <RequestDetailDialog
        {...shared}
        requestId={dialogs.openId}
        onClose={dialogs.closeDetail}
        onChanged={onChanged}
        onOpenBudget={() => leave(onOpenBudget)}
        onOpenExpense={id => leave(() => onOpenExpense(id))}
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

// 옆 메뉴 '재정': 구매 요청 탭(거르기 셋: 내 요청, 결재 대기, 전체)과 예산 탭. 거르기를 바꾸면 이전 거르기의 늦은 응답은 버린다.
// 납부자 명단을 보던 중 권한을 잃으면(탭이 사라지면) 구매 요청으로 돌아간다.
export default function FinancePage(props: Props) {
  const [filter, setFilter] = useState<PurchaseView>('mine')
  const [tab, setTab] = useState<FinanceTab>('requests')
  const dialogs = useRecordDialogs(props.initialRequestId)
  const expenseDialogs = useRecordDialogs()
  const list = usePurchases(props.view.council.id, filter, props.onForbidden)
  // 지출 목록은 지출 탭이 열려 있을 때만 읽는다.
  const expenses = useExpenses(props.view.council.id, props.onForbidden, tab === 'expenses')
  const can = (action: Action) => props.view.permissions.includes(action)
  const shownTab = tab === 'fees' && !can('fee_payment.view') ? 'requests' : tab
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
        councilId={props.view.council.id}
        dialogs={dialogs}
        onChanged={() => {
          void list.reload()
          props.onChanged()
        }}
        onForbidden={props.onForbidden}
        onOpenBudget={() => setTab('budget')}
        onOpenExpense={expenseDialogs.openRecord}
      />
      <FinanceTabs tab={shownTab} onTab={setTab} showFees={can('fee_payment.view')} />
      <FinanceTabPanel
        tab={shownTab}
        filter={filter}
        onFilter={setFilter}
        list={list}
        expenses={expenses}
        view={props.view}
        onOpen={dialogs.openRecord}
        onOpenExpense={expenseDialogs.openRecord}
        onForbidden={props.onForbidden}
      />
    </PageColumn>
  )
}
