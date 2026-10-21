import type { ExpenseDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EXPENSE_LOAD_FAILED } from '@/lib/messages'
import { ExpenseActions } from './ExpenseActions'
import { ExpenseFacts, ExpenseLines, ExpenseRecords } from './ExpenseFacts'
import type { ExpenseDialogHandlers } from './expense-requests'
import { EvidenceSection } from './EvidenceSection'
import { useEvidenceUpload } from './useEvidenceUpload'
import { useExpenseDetail } from './useExpenseDetail'

type Props = ExpenseDialogHandlers & {
  councilId: string
  // 재정부(finance.manage)인가. 사진 붙이기를 보일지 정한다. 취소·환급은 서버가 준 동작을 따른다.
  canManage: boolean
  // 열린 지출의 번호. null이면 닫혀 있다.
  expenseId: string | null
  onClose: () => void
}

// 지출 상세 대화상자. 열려 있을 때만 읽고, 지출이 바뀌면 처음부터 다시 읽는다.
export function ExpenseDetailDialog({ expenseId, ...props }: Props) {
  if (expenseId === null) return null
  return <OpenExpenseDialog key={expenseId} expenseId={expenseId} {...props} />
}

function OpenExpenseDialog({
  councilId,
  canManage,
  expenseId,
  onClose,
  ...handlers
}: Props & { expenseId: string }) {
  const detail = useExpenseDetail(councilId, expenseId, handlers)
  const upload = useEvidenceUpload(councilId, expenseId, {
    handlers,
    onAttached: detail.apply,
    onStale: () => void detail.reload(),
  })
  const busy = detail.saving || upload.attaching
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{detail.expense?.vendor ?? '지출'}</DialogTitle>
        </DialogHeader>
        {detail.expense ? (
          <Loaded {...{ councilId, canManage, detail, upload }} expense={detail.expense} />
        ) : detail.loadFailed ? (
          <div className="flex flex-col items-start gap-3">
            <StateMessage kind="error">{EXPENSE_LOAD_FAILED}</StateMessage>
            <Button variant="outline" onClick={detail.retry}>
              다시 시도
            </Button>
          </div>
        ) : (
          <StateMessage kind="loading">불러오는 중이에요</StateMessage>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Loaded({
  councilId,
  canManage,
  expense,
  detail,
  upload,
}: {
  councilId: string
  canManage: boolean
  expense: ExpenseDetail
  detail: ReturnType<typeof useExpenseDetail>
  upload: ReturnType<typeof useEvidenceUpload>
}) {
  return (
    <div className="flex flex-col gap-6">
      <ExpenseFacts expense={expense} />
      <ExpenseLines lines={expense.lines} />
      <EvidenceSection {...{ councilId, expense, canManage, upload }} />
      <ExpenseActions expense={expense} detail={detail} />
      <ExpenseRecords expense={expense} />
    </div>
  )
}
