import { useState, type FormEvent } from 'react'
import { UpdatePurchaseItemSchema, type PurchaseItemSummary, type UpdatePurchaseItemRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { productNameOf } from './PurchaseItemCard'

export type DraftFields = Omit<UpdatePurchaseItemRequest, 'version'>
type Props = { item: PurchaseItemSummary | null; busy: boolean; error: string; onClose: () => void
  onSave: (item: PurchaseItemSummary, fields: DraftFields) => void }
const toText = (value: string) => value.trim() === '' ? null : value
const toNumber = (value: string) => value.trim() === '' ? null : Number(value)

// 작성 중 품목만 고친다. 빈 칸은 모르는 값(null)으로 저장한다.
export default function DraftEditDialog({ item, busy, error, onClose, onSave }: Props) {
  return <Dialog open={item !== null} onOpenChange={open => { if (!open && !busy) onClose() }}>
    {item && <DialogContent><EditForm key={`${item.id}:${item.version}`} item={item} busy={busy} error={error} onClose={onClose} onSave={onSave} /></DialogContent>}
  </Dialog>
}

function EditForm({ item, busy, error, onClose, onSave }: Omit<Props, 'item'> & { item: PurchaseItemSummary }) {
  const [values, setValues] = useState({ productName: item.productName ?? '', selectedOption: item.selectedOption ?? '',
    optionRequired: item.optionRequired === null ? 'unknown' : item.optionRequired ? 'yes' : 'no', packagingUnit: item.packagingUnit ?? '',
    quantity: item.quantity?.toString() ?? '', estimatedUnitPrice: item.estimatedUnitPrice?.toString() ?? '', note: item.note ?? '' })
  const fields: DraftFields = { productName: toText(values.productName), selectedOption: toText(values.selectedOption),
    optionRequired: values.optionRequired === 'unknown' ? null : values.optionRequired === 'yes', packagingUnit: toText(values.packagingUnit),
    quantity: toNumber(values.quantity), estimatedUnitPrice: toNumber(values.estimatedUnitPrice), note: toText(values.note) }
  const valid = UpdatePurchaseItemSchema.safeParse({ version: item.version, ...fields }).success
  const change = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues(previous => ({ ...previous, [key]: event.target.value }))
  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid && !busy) onSave(item, fields)
  }
  return <form className="flex flex-col gap-4" onSubmit={submit}>
    <DialogHeader><DialogTitle>품목 수정</DialogTitle><DialogDescription className="wrap-anywhere">{productNameOf(item)}</DialogDescription></DialogHeader>
    <Label className="flex flex-col gap-1.5">상품명<Input value={values.productName} onChange={change('productName')} /></Label>
    <div className="grid gap-4 sm:grid-cols-2">
      <Label className="flex flex-col gap-1.5">선택 옵션<Input value={values.selectedOption} onChange={change('selectedOption')} /></Label>
      <Label className="flex flex-col gap-1.5">옵션 필요 여부<NativeSelect value={values.optionRequired} onChange={change('optionRequired')}>
        <option value="unknown">확인 필요</option><option value="yes">옵션 선택 필요</option><option value="no">옵션 없음</option>
      </NativeSelect></Label>
      <Label className="flex flex-col gap-1.5">포장 단위<Input value={values.packagingUnit} onChange={change('packagingUnit')} /></Label>
      <Label className="flex flex-col gap-1.5">수량<Input type="number" inputMode="numeric" min={1} step={1} value={values.quantity} onChange={change('quantity')} /></Label>
      <Label className="flex flex-col gap-1.5">예상 단가 (원)<Input type="number" inputMode="numeric" min={0} step={1} value={values.estimatedUnitPrice} onChange={change('estimatedUnitPrice')} /></Label>
    </div>
    <Label className="flex flex-col gap-1.5">용도<Textarea value={values.note} rows={2} onChange={change('note')} /></Label>
    {error && <StateMessage kind="error">{error}</StateMessage>}
    <DialogFooter>
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>취소</Button>
      <Button disabled={busy || !valid}>저장</Button>
    </DialogFooter>
  </form>
}
