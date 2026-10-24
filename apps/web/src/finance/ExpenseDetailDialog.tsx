import type { ExpenseDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { HistoryMenu } from '@/components/HistoryMenu'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EXPENSE_LOAD_FAILED } from '@/lib/messages'
import { ExpenseActions } from './ExpenseActions'
import { ExpenseApprovals, ExpenseFacts, ExpenseLines } from './ExpenseFacts'
import type { ExpenseDialogHandlers } from './expense-requests'
import { versionLine } from './expense-text'
import { EvidenceSection } from './EvidenceSection'
import { useChatEvidence } from './useChatEvidence'
import { useEvidenceUpload } from './useEvidenceUpload'
import { useMessageEvidence } from './useMessageEvidence'
import { useExpenseDetail } from './useExpenseDetail'

type Props = ExpenseDialogHandlers & {
  councilId: string
  // 열린 지출의 번호. null이면 닫혀 있다.
  expenseId: string | null
  onClose: () => void
  // 메시지에서 지출을 적고 열었으면 그 메시지의 사진 번호들. 먼저 붙이자고 보인다.
  messagePhotoIds?: string[] | undefined
}

// 지출 상세 대화상자. 열려 있을 때만 읽고, 지출이 바뀌면 처음부터 다시 읽는다.
export function ExpenseDetailDialog({ expenseId, ...props }: Props) {
  if (expenseId === null) return null
  return <OpenExpenseDialog key={expenseId} expenseId={expenseId} {...props} />
}

const NO_PHOTOS: string[] = []

function OpenExpenseDialog({
  councilId,
  expenseId,
  onClose,
  messagePhotoIds = NO_PHOTOS,
  ...handlers
}: Props & { expenseId: string }) {
  const detail = useExpenseDetail(councilId, expenseId, handlers)
  const evidenceHooks = {
    handlers,
    onAttached: detail.apply,
    onStale: () => void detail.reload(),
  }
  const upload = useEvidenceUpload(councilId, expenseId, evidenceHooks)
  const chat = useChatEvidence(councilId, expenseId, evidenceHooks)
  const message = useMessageEvidence(councilId, expenseId, messagePhotoIds, evidenceHooks)
  const busy = detail.saving || upload.attaching || chat.attaching || message.attaching
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader className="flex-row items-center justify-between gap-2">
          <DialogTitle className="wrap-anywhere">{detail.expense?.vendor ?? '지출'}</DialogTitle>
          {detail.expense && <HistoryMenu history={detail.expense.history} line={versionLine} />}
        </DialogHeader>
        {detail.expense ? (
          <Loaded
            {...{ councilId, detail, upload, chat, message }}
            expense={detail.expense}
            onForbidden={handlers.onForbidden}
          />
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
  expense,
  detail,
  upload,
  chat,
  message,
  onForbidden,
}: {
  onForbidden: () => void
  councilId: string
  expense: ExpenseDetail
  detail: ReturnType<typeof useExpenseDetail>
  upload: ReturnType<typeof useEvidenceUpload>
  chat: ReturnType<typeof useChatEvidence>
  message: ReturnType<typeof useMessageEvidence>
}) {
  return (
    <div className="flex flex-col gap-6">
      <ExpenseFacts expense={expense} />
      <ExpenseLines lines={expense.lines} />
      <EvidenceSection {...{ councilId, expense, upload, chat, message }} />
      <ExpenseActions
        councilId={councilId}
        expense={expense}
        detail={detail}
        onForbidden={onForbidden}
      />
      <ExpenseApprovals approvals={expense.approvals} />
    </div>
  )
}
