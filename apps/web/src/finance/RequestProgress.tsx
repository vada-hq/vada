import {
  purchaseProgressOf,
  type PurchaseProgress,
  type PurchaseRequestDetail,
  type PurchaseRequestSummary,
} from '@vada/contracts'

// 금액을 다시 계산하지 않는다. 결제는 API의 paid, 배송은 실제 취소되지 않은 송장으로만 표시한다.
export function RequestProgress({
  request,
}: {
  request: PurchaseRequestDetail | PurchaseRequestSummary
}) {
  if (request.status === 'rejected' || request.status === 'cancelled') return null
  const progress = 'items' in request ? purchaseProgressOf(request) : request.progress
  if (!progress) return null
  const steps = [
    { label: '요청함', done: true },
    { label: '결재', done: progress.decided },
    paymentStep(progress),
    ...(progress.hasShipment ? [{ label: '배송', done: false, text: '송장 등록됨' }] : []),
  ]
  return (
    <ol aria-label="구매 요청 진행" className="grid grid-flow-col gap-2">
      {steps.map(step => (
        <li
          key={step.label}
          className={`flex min-w-0 flex-col gap-2 border-t-4 pt-2 text-sm break-keep ${step.done ? 'border-primary-emphasis text-primary-strong' : 'border-border-default text-fg-muted'}`}
        >
          <span>{step.label}</span>
          <span className="text-xs">
            {'text' in step ? step.text : step.done ? '완료' : '대기'}
          </span>
        </li>
      ))}
    </ol>
  )
}

function paymentStep({ paid, partlyPaid }: PurchaseProgress) {
  return { label: '결제', done: paid, text: partlyPaid ? '일부 결제' : paid ? '완료' : '대기' }
}
