import type { TeamResponse, MadeRecord } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { useDialogGuard } from '@/lib/use-dialog-guard'
import { ExpenseCreateDialog } from '../finance/ExpenseCreateDialog'
import { ExpenseDetailDialog } from '../finance/ExpenseDetailDialog'
import { expenseSeedOf } from './expense-seed'
import type { ExpenseFlow } from './useExpenseFlow'

type Props = {
  councilId: string
  meId: string
  // 지금 운영진. 아직 못 읽었으면 null이다.
  team: TeamResponse | null
  // 받은 권한 목록의 값을 그대로 쓴다(화면이 다시 계산하지 않는다).
  canManage: boolean
  flow: ExpenseFlow
  onMade?: ((messageId: string, made: MadeRecord) => void) | undefined
  onForbidden: () => void
}

// 지출 적기 대화상자와, 적은 뒤 열리는 지출 상세(그 메시지의 사진 붙이기가 먼저 보인다), 잃은 이유.
export default function ExpenseFlowView({
  councilId,
  meId,
  team,
  canManage,
  flow,
  onForbidden,
  onMade,
}: Props) {
  const { writing, made } = flow
  // 열려 있는 동안 권한을 잃으면 닫고 이유를 보인다.
  useDialogGuard(
    writing !== null || made !== null,
    canManage ? null : PERMISSION_CHANGED,
    flow.lose,
  )
  const start = writing
    ? expenseSeedOf(writing, { meId, members: team?.members ?? null })
    : undefined
  return (
    <>
      <ExpenseCreateDialog
        open={writing !== null}
        councilId={councilId}
        memberId={meId}
        start={start}
        onClose={flow.close}
        onCreated={expense => {
          if (writing)
            onMade?.(writing.id, {
              kind: 'expense',
              id: expense.id,
              title: expense.description,
              blocking: true,
            })
          flow.finish(expense.id)
        }}
        onLost={flow.lose}
        onForbidden={onForbidden}
      />
      <ExpenseDetailDialog
        councilId={councilId}
        expenseId={made?.expenseId ?? null}
        messagePhotoIds={made?.photoIds}
        onClose={flow.closeDetail}
        onChanged={() => {}}
        onLost={flow.lose}
        onForbidden={onForbidden}
      />
      {flow.lost && <StateMessage kind="notice">{flow.lost}</StateMessage>}
    </>
  )
}
