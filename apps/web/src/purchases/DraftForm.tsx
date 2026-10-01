import { useId, useState } from 'react'
import type { PurchaseDetail, UpdatePurchaseDraftRequest } from '@vada/contracts'
import { createDraftValues, analyzeDraft, serializeDraft } from './draft-form-model'

export type DraftFormProps = {
  request: PurchaseDetail; busy: boolean; stale: boolean; dirty: boolean; readOnly: boolean
  onDirty: (value: boolean) => void
  onSave: (input: UpdatePurchaseDraftRequest) => void
  onDiscard: () => void; onSubmit: () => void
}
export default function DraftForm({ request, busy, stale, dirty, readOnly, onDirty, onSave, onDiscard, onSubmit }: DraftFormProps) {
  const [purpose, setPurpose] = useState(request.purpose ?? '')
  const [neededBy, setNeededBy] = useState(request.neededBy ?? '')
  const [shipping, setShipping] = useState(request.estimatedShippingCost?.toString() ?? '')
  const [items, setItems] = useState(() => createDraftValues(request).items)
  const prefix = useId()
  const readonly = readOnly || request.status !== 'draft'
  const values = { purpose, neededBy, shipping, items }
  const { invalid, missing, total } = analyzeDraft(values)
  function changeItem(index: number, key: string, value: string | boolean | null) {
    setItems(previous => previous.map((item, i) => i === index ? { ...item, [key]: value } : item)); onDirty(true)
  }
  return <section className="draft-editor" aria-label="초안 상세">
    <form aria-label="초안 수정" onSubmit={event => {
      event.preventDefault()
      if (busy || readonly || stale || invalid) return
      onSave(serializeDraft(values, request.version))
    }}>
      <fieldset disabled={busy || readonly}>
        <label htmlFor={`${prefix}-purpose`}>구매 목적</label>
        <textarea id={`${prefix}-purpose`} value={purpose} onChange={event => { setPurpose(event.target.value); onDirty(true) }} placeholder="확인 필요" />
        <label htmlFor={`${prefix}-date`}>필요한 날짜</label>
        <input id={`${prefix}-date`} type="date" value={neededBy} onChange={event => { setNeededBy(event.target.value); onDirty(true) }} />
        {items.map((item, index) => <fieldset key={item.id} className="purchase-item"><legend>물품 {index + 1}</legend>
          <a href={item.productUrl} target="_blank" rel="noopener noreferrer">상품 링크 열기</a>
          {(['productName', 'selectedOption', 'packagingUnit', 'quantity', 'estimatedUnitPrice'] as const).map((key, field) => <label key={key}>
            {['상품명', '선택 옵션', '포장 단위', '주문 수량', '예상 단가 (원)'][field]}
            <input value={item[key]} type={field >= 3 ? 'number' : 'text'} min={key === 'quantity' ? 1 : 0} step={1} max={field >= 3 ? 2147483647 : undefined}
              placeholder="확인 필요" onChange={event => changeItem(index, key, event.target.value)} />
          </label>)}
          <label>옵션 선택 필요 여부<select value={item.optionRequired === null ? 'unknown' : item.optionRequired ? 'yes' : 'no'}
            onChange={event => changeItem(index, 'optionRequired', event.target.value === 'unknown' ? null : event.target.value === 'yes')}>
            <option value="unknown">확인 필요</option><option value="yes">옵션 선택 필요</option><option value="no">옵션 없음</option>
          </select></label>
          {!item.selectedOption && item.optionRequired !== false && <p className="hint">선택 옵션을 상품 링크에서 확인해 주세요.</p>}
          <p className="hint">포장 단위와 주문 수량은 달라요. 40개입 2묶음이면 주문 수량은 2예요.</p>
        </fieldset>)}
        <label htmlFor={`${prefix}-shipping`}>예상 배송비 (원)</label>
        <input id={`${prefix}-shipping`} type="number" min={0} step={1} max={2147483647} value={shipping} placeholder="확인 필요" onChange={event => { setShipping(event.target.value); onDirty(true) }} />
      </fieldset>
      <p>예상 합계: {total === null ? '확인 필요' : `${total.toLocaleString('ko-KR')}원`}</p>
      <p className="hint">비어 있는 값은 미확인으로 저장해요. 예상 금액은 실제 결제 금액이 아니에요.</p>
      {!readonly && <><button disabled={busy || stale || invalid}>초안 저장</button><button type="button" className="danger" disabled={busy || stale} onClick={onDiscard}>초안 폐기</button></>}
    </form>
    {!readonly && <>
      {missing.length > 0 && <p>제출 전 확인: {missing.join(', ')}</p>}
      {dirty && <p>수정한 내용을 먼저 저장해 주세요.</p>}
      <p className="hint">금액이 미확인이어도 제출할 수 있어요. 제출 후에는 수정·폐기가 불가능해요.</p>
      <button disabled={busy || stale || dirty || invalid || missing.length > 0} onClick={onSubmit}>요청서 제출</button>
    </>}
  </section>
}
