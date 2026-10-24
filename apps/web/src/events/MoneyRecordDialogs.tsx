import type { useRecordDialogs } from '@/lib/use-record-dialogs'
import { ExpenseDetailDialog } from '../finance/ExpenseDetailDialog'
import { RequestDetailDialog } from '../finance/RequestDetailDialog'

type Dialogs = ReturnType<typeof useRecordDialogs>

type Props = {
  councilId: string
  requests: Dialogs
  expenses: Dialogs
  // 내가 바꾼 뒤, 또는 열어 둔 것을 잃은 뒤 정산을 다시 읽는다.
  onChanged: () => void
  onForbidden: () => void
}

// 정산의 남은 것에서 연 요청과 지출의 상세. 바뀌면 정산을 다시 읽고, 잃으면(404·403) 닫고 이유를 탭 위에 보인다.
// 요청에서 결제한 지출을 누르면 요청을 닫고 지출을 연다. 예산 탭으로 가는 길은 이 화면에 없어 그 버튼은 숨긴다.
export function MoneyRecordDialogs({
  councilId,
  requests,
  expenses,
  onChanged,
  onForbidden,
}: Props) {
  const shared = { councilId, onChanged, onForbidden }
  return (
    <>
      <RequestDetailDialog
        {...shared}
        requestId={requests.openId}
        onClose={requests.closeDetail}
        onLost={message => {
          requests.lose(message)
          onChanged()
        }}
        onOpenExpense={id => {
          requests.closeDetail()
          expenses.openRecord(id)
        }}
      />
      <ExpenseDetailDialog
        {...shared}
        expenseId={expenses.openId}
        onClose={expenses.closeDetail}
        onLost={message => {
          expenses.lose(message)
          onChanged()
        }}
      />
    </>
  )
}
