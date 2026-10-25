import type { CouncilView } from '@vada/contracts'
import { openRecord } from '@/lib/go-to'
import type { useRecordDialogs } from '@/lib/use-record-dialogs'
import { ExpenseCreateDialog } from './ExpenseCreateDialog'
import { ExpenseDetailDialog } from './ExpenseDetailDialog'

type Props = {
  view: CouncilView
  dialogs: ReturnType<typeof useRecordDialogs>
  // 내가 바꾼 뒤 지출 목록을 다시 읽는다.
  onChanged: () => void
  onForbidden: () => void
}

// 지출 상세와 지출 적기 대화상자. 적고 나면 목록을 다시 읽고, 그 지출의 주소로 상세를 열어 사진을 붙이게 한다.
// 열려 있던 지출이 사라지거나(404) 권한을 잃으면(403) 닫고 이유를 목록 위에 보인다.
export function ExpenseDialogs({ view, dialogs, onChanged, onForbidden }: Props) {
  const councilId = view.council.id
  const lose = (message: string) => {
    dialogs.lose(message)
    onChanged()
  }
  return (
    <>
      <ExpenseDetailDialog
        councilId={councilId}
        expenseId={dialogs.openId}
        onClose={dialogs.closeDetail}
        onChanged={onChanged}
        onLost={lose}
        onForbidden={onForbidden}
      />
      <ExpenseCreateDialog
        councilId={councilId}
        memberId={view.me.memberId}
        open={dialogs.creating}
        onClose={dialogs.closeCreate}
        onCreated={expense => {
          onChanged()
          dialogs.closeCreate()
          openRecord('expenses', councilId, expense.id)
        }}
        onLost={lose}
        onForbidden={onForbidden}
      />
    </>
  )
}
