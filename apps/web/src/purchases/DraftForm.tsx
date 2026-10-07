import { useId, useState } from 'react'
import type { PurchaseDetail, UpdatePurchaseDraftRequest } from '@vada/contracts'
import { createDraftValues, analyzeDraft, serializeDraft } from './draft-form-model'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

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
  return <section className="flex min-w-0 flex-col gap-3" aria-label="초안 상세">
    <form aria-label="초안 수정" className="flex flex-col gap-3" onSubmit={event => {
      event.preventDefault()
      if (busy || readonly || stale || invalid) return
      onSave(serializeDraft(values, request.version))
    }}>
      <fieldset disabled={busy || readonly} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-purpose`}>구매 목적</Label>
          <Textarea id={`${prefix}-purpose`} value={purpose} onChange={event => { setPurpose(event.target.value); onDirty(true) }} placeholder="확인 필요" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-date`}>필요한 날짜</Label>
          <Input id={`${prefix}-date`} type="date" value={neededBy} onChange={event => { setNeededBy(event.target.value); onDirty(true) }} />
        </div>
        {items.map((item, index) => <fieldset key={item.id} className="grid min-w-0 gap-3 rounded-md border p-4 md:grid-cols-2"><legend className="px-1 text-xs font-semibold text-gray-700">물품 {index + 1}</legend>
          <a className="text-sm md:col-span-2" href={item.productUrl} target="_blank" rel="noopener noreferrer">상품 링크 열기</a>
          {(['productName', 'selectedOption', 'packagingUnit', 'quantity', 'estimatedUnitPrice'] as const).map((key, field) => <Label key={key} className="flex flex-col gap-1.5">
            {['상품명', '선택 옵션', '포장 단위', '주문 수량', '예상 단가 (원)'][field]}
            <Input value={item[key]} type={field >= 3 ? 'number' : 'text'} min={key === 'quantity' ? 1 : 0} step={1} max={field >= 3 ? 2147483647 : undefined}
              placeholder="확인 필요" onChange={event => changeItem(index, key, event.target.value)} />
          </Label>)}
          <Label className="flex flex-col gap-1.5">옵션 선택 필요 여부<NativeSelect value={item.optionRequired === null ? 'unknown' : item.optionRequired ? 'yes' : 'no'}
            onChange={event => changeItem(index, 'optionRequired', event.target.value === 'unknown' ? null : event.target.value === 'yes')}>
            <option value="unknown">확인 필요</option><option value="yes">옵션 선택 필요</option><option value="no">옵션 없음</option>
          </NativeSelect></Label>
          {!item.selectedOption && item.optionRequired !== false && <p className="text-xs text-gray-500 md:col-span-2">선택 옵션을 상품 링크에서 확인해 주세요.</p>}
          <p className="text-xs text-gray-500 md:col-span-2">포장 단위와 주문 수량은 달라요. 40개입 2묶음이면 주문 수량은 2예요.</p>
        </fieldset>)}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-shipping`}>예상 배송비 (원)</Label>
          <Input id={`${prefix}-shipping`} type="number" min={0} step={1} max={2147483647} value={shipping} placeholder="확인 필요" onChange={event => { setShipping(event.target.value); onDirty(true) }} />
        </div>
      </fieldset>
      <p className="text-sm font-medium">예상 합계: {total === null ? '확인 필요' : `${total.toLocaleString('ko-KR')}원`}</p>
      <p className="text-xs text-gray-500">비어 있는 값은 미확인으로 저장해요. 예상 금액은 실제 결제 금액이 아니에요.</p>
      {!readonly && <div className="flex flex-wrap gap-2"><Button disabled={busy || stale || invalid}>초안 저장</Button><Button type="button" variant="destructive" disabled={busy || stale} onClick={onDiscard}>초안 폐기</Button></div>}
    </form>
    {!readonly && <>
      {missing.length > 0 && <p className="text-sm text-gray-700">제출 전 확인: {missing.join(', ')}</p>}
      {dirty && <p className="text-sm text-gray-700">수정한 내용을 먼저 저장해 주세요.</p>}
      <p className="text-xs text-gray-500">금액이 미확인이어도 제출할 수 있어요. 제출 후에는 수정·폐기가 불가능해요.</p>
      <Button className="self-start" disabled={busy || stale || dirty || invalid || missing.length > 0} onClick={onSubmit}>요청서 제출</Button>
    </>}
  </section>
}
