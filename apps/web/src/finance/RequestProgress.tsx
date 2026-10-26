import type { PurchaseLineItem, PurchaseRequestDetail } from '@vada/contracts'
import { STATUS_LABEL } from './purchase-view'

// 금액을 다시 계산하지 않는다. 결제는 API의 paid, 배송은 실제 취소되지 않은 송장으로만 표시한다.
export function RequestProgress({ request }: { request: PurchaseRequestDetail }) {
  if (request.status === 'rejected' || request.status === 'cancelled')
    return (
      <p role="status" className="text-sm text-gray-700">
        {STATUS_LABEL[request.status]}된 요청이에요.
      </p>
    )
  const approved = request.items.filter(item => item.status === 'approved')
  const decided = request.items.length > 0 && request.items.every(item => item.status !== 'pending')
  const shipments = request.shipments.filter(shipment => !shipment.cancelledAt)
  const steps = [
    { label: '요청함', done: true },
    { label: '결재', done: decided },
    paymentStep(approved, decided),
    ...(shipments.length ? [{ label: '배송', done: false, text: '송장 등록됨' }] : []),
  ]
  return (
    <ol aria-label="구매 요청 진행" className="grid grid-flow-col gap-2">
      {steps.map(step => (
        <li
          key={step.label}
          className={`flex flex-col gap-2 border-t-4 pt-2 text-sm ${step.done ? 'border-blue-600 text-blue-700' : 'border-gray-200 text-gray-500'}`}
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

function paymentStep(approved: PurchaseLineItem[], decided: boolean) {
  const paid = decided && approved.length > 0 && approved.every(item => item.paid)
  const partlyPaid = approved.some(item => item.paid) && !paid
  return { label: '결제', done: paid, text: partlyPaid ? '일부 결제' : paid ? '완료' : '대기' }
}
