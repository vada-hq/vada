import { useState } from 'react'
import type { PurchaseRequestDetail } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PURCHASE_LOAD_FAILED } from '@/lib/messages'
import { neededByLabel } from './purchase-view'
import type { PurchaseDialogHandlers } from './purchase-requests'
import { DecisionPanel } from './DecisionPanel'
import { RequestExpenses } from './RequestExpenses'
import { RequestItems } from './RequestItems'
import { RequestDecisions, RequestHistory } from './RequestRecords'
import { StatusBadge } from './StatusBadge'
import { useRequestDetail } from './useRequestDetail'

type Props = PurchaseDialogHandlers & {
  councilId: string
  // 열린 요청의 번호. null이면 닫혀 있다. 카드를 눌러 열고 닫는 일은 부모가 한다.
  requestId: string | null
  onClose: () => void
  // 결재할 기간이나 항목이 없을 때 예산 탭으로 간다(부모가 대화상자를 닫는다).
  onOpenBudget?: (() => void) | undefined
  // 결제한 지출을 누르면 그 지출을 연다(부모가 이 대화상자를 닫고 지출 상세를 연다).
  onOpenExpense: (expenseId: string) => void
}

// 구매 요청 상세 대화상자. 열려 있을 때만 읽고, 요청이 바뀌면 처음부터 다시 읽는다.
export function RequestDetailDialog({ requestId, ...props }: Props) {
  if (requestId === null) return null
  return <OpenRequestDialog key={requestId} requestId={requestId} {...props} />
}

function OpenRequestDialog({
  councilId,
  requestId,
  onClose,
  onOpenBudget,
  onOpenExpense,
  ...handlers
}: Props & { requestId: string }) {
  const detail = useRequestDetail(councilId, requestId, handlers)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !detail.saving) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            {detail.request?.title ?? '구매 요청'}
          </DialogTitle>
        </DialogHeader>
        {detail.request ? (
          <Loaded
            request={detail.request}
            detail={detail}
            councilId={councilId}
            onForbidden={handlers.onForbidden}
            onOpenBudget={onOpenBudget}
            onOpenExpense={onOpenExpense}
          />
        ) : detail.loadFailed ? (
          <div className="flex flex-col items-start gap-3">
            <StateMessage kind="error">{PURCHASE_LOAD_FAILED}</StateMessage>
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

function Facts({ request }: { request: PurchaseRequestDetail }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <StatusBadge status={request.status} />
        <span className="wrap-anywhere">{request.requestedBy.name}</span>
        <span>{neededByLabel(request.neededBy)}</span>
      </div>
      {request.body && (
        <p className="text-sm wrap-anywhere whitespace-pre-wrap text-gray-800">{request.body}</p>
      )}
    </div>
  )
}

// [요청 취소]는 서버가 준 동작에 있을 때만 보이고, 한 번 확인을 거친다. 이미 닫힌 요청이면 확인을 닫고 이유를 요청 옆에 보인다.
function CancelButton({ detail }: { detail: ReturnType<typeof useRequestDetail> }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="outline" busy={detail.saving} onClick={() => setConfirming(true)}>
        요청 취소
      </Button>
      {!confirming && detail.problem && <StateMessage kind="error">{detail.problem}</StateMessage>}
      <ConfirmDialog
        open={confirming}
        destructive
        busy={detail.saving}
        error={detail.problem ?? ''}
        title="이 요청을 취소할까요?"
        description="결재가 시작되기 전에만 취소할 수 있어요. 취소한 요청은 되살릴 수 없어요."
        confirmLabel="요청 취소"
        onClose={() => {
          detail.clearProblem()
          setConfirming(false)
        }}
        onConfirm={() => {
          void detail.cancel().then(outcome => {
            if (outcome !== 'failed') setConfirming(false)
          })
        }}
      />
    </div>
  )
}

function Loaded({
  request,
  detail,
  councilId,
  onForbidden,
  onOpenBudget,
  onOpenExpense,
}: {
  request: PurchaseRequestDetail
  detail: ReturnType<typeof useRequestDetail>
  councilId: string
  onForbidden: () => void
  onOpenBudget: (() => void) | undefined
  onOpenExpense: (expenseId: string) => void
}) {
  const deciding =
    request.actions.includes('purchase_request.decide') &&
    request.items.some(i => i.status === 'pending')
  return (
    <div className="flex flex-col gap-6">
      <Facts request={request} />
      <RequestItems items={request.items} cancel={detail.itemCancel} />
      <RequestExpenses expenses={request.expenses} onOpen={onOpenExpense} />
      {deciding && (
        <DecisionPanel
          councilId={councilId}
          items={request.items}
          decide={detail.decide}
          onForbidden={onForbidden}
          onOpenBudget={onOpenBudget}
        />
      )}
      {/* 남이 먼저 결재하거나 취소해 결재 칸이 사라져도 이유는 남긴다. */}
      {!deciding && detail.decide.problem && (
        <StateMessage kind="error">{detail.decide.problem}</StateMessage>
      )}
      <RequestDecisions decisions={request.decisions} items={request.items} />
      {request.actions.includes('purchase_request.cancel') && <CancelButton detail={detail} />}
      {detail.problem && !request.actions.includes('purchase_request.cancel') && (
        <StateMessage kind="error">{detail.problem}</StateMessage>
      )}
      <RequestHistory history={request.history} />
    </div>
  )
}
