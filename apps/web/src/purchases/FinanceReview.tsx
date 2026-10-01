import { useId, useState } from 'react'
import StateMessage from '../shared/ui/StateMessage'

type Props = {
  busy: boolean; stale: boolean; amountUnknown: boolean
  onDirty: (value: boolean) => void
  onDecide: (decision: 'approved' | 'rejected', reason: string) => void
}

export default function FinanceReview({ busy, stale, amountUnknown, onDirty, onDecide }: Props) {
  const [reason, setReason] = useState('')
  const reasonId = useId()
  return <section className="finance-review" aria-label="재정부 처리">
    <h3>요청서 검토</h3>
    <p className="hint">요청서 전체를 승인하거나 반려해요. 처리 후에는 변경할 수 없어요.</p>
    {amountUnknown && <p className="hint">금액이 미확인입니다. 승인 전 상품 가격과 배송비를 별도로 확인해 주세요.</p>}
    {stale && <StateMessage kind="notice">최신 요청서를 다시 불러온 뒤 검토해 주세요.</StateMessage>}
    <label htmlFor={reasonId}>반려 사유</label>
    <textarea id={reasonId} value={reason} disabled={busy || stale} maxLength={2000}
      onChange={event => { setReason(event.target.value); onDirty(true) }} placeholder="반려할 경우 사유를 입력해 주세요." />
    <div className="purchase-actions">
      <button disabled={busy || stale} onClick={() => {
        if (window.confirm(`${amountUnknown ? '금액이 미확인입니다. 별도로 확인했나요?\n' : ''}이 요청을 승인할까요? 처리 후에는 변경할 수 없어요.`)) onDecide('approved', '')
      }}>요청 승인</button>
      <button className="danger" disabled={busy || stale || !reason.trim() || [...reason].length > 2000} onClick={() => {
        if (window.confirm('입력한 사유로 반려할까요? 처리 후에는 변경할 수 없어요.')) onDecide('rejected', reason)
      }}>요청 반려</button>
    </div>
  </section>
}
