import { useEffect, useRef, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { RECEIPT_KINDS, VoidExpenseSchema, type ExpenseDetail, type ReceiptKind, type ReceiptSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { productNameOf } from '../purchases/PurchaseItemCard'
import { timeText, won } from '../purchases/purchase-view'
import { comparisonText, eventText, historyText, kindLabels, methodLabels } from './expense-view'
import { expensesBase, fetchExpense, sendExpense } from './useExpenses'
import { useReceiptUpload } from './useReceiptUpload'

type Props = {
  organizationId: string
  expenseId: string | null
  finance: boolean
  onClose: () => void
  // 증빙·취소로 지출이 바뀌면 목록을 새로 불러오게 알린다.
  onChanged: () => void
  // 수정 대화상자를 연다. 없으면 수정 버튼을 두지 않는다.
  onEdit?: (expense: ExpenseDetail) => void
}
// 브라우저가 바로 보여 주는 사진만 미리 보기로 그린다. HEIC·PDF는 파일 이름 링크다.
const previewable = (receipt: ReceiptSummary) => ['image/jpeg', 'image/png', 'image/webp'].includes(receipt.contentType)

// 지출 상세. 연결 품목, 승인 금액 비교, 증빙, 처리 기록을 보여 주고, 재정 권한자는 증빙을 올리고 지우거나 지출을 취소한다.
export default function ExpenseDetailDialog({ expenseId, onClose, ...props }: Props) {
  return <Dialog open={expenseId !== null} onOpenChange={open => { if (!open) onClose() }}>
    {expenseId && <DialogContent><Detail key={expenseId} expenseId={expenseId} {...props} /></DialogContent>}
  </Dialog>
}

function Detail({ organizationId, expenseId, finance, onChanged, onEdit }: Omit<Props, 'expenseId' | 'onClose'> & { expenseId: string }) {
  const [expense, setExpense] = useState<ExpenseDetail | null | undefined>(undefined)
  const [kind, setKind] = useState<ReceiptKind>('receipt')
  const [voidReason, setVoidReason] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let current = true
    void fetchExpense(organizationId, expenseId).then(value => { if (current) setExpense(value) })
    return () => { current = false }
  }, [organizationId, expenseId])
  const uploader = useReceiptUpload(organizationId, expenseId, next => { setExpense(next); onChanged() })
  if (expense === undefined) return <>
    <DialogHeader><DialogTitle>지출</DialogTitle><DialogDescription>불러오는 중…</DialogDescription></DialogHeader>
    <StateMessage kind="loading">불러오는 중…</StateMessage>
  </>
  if (expense === null) return <>
    <DialogHeader><DialogTitle>지출</DialogTitle><DialogDescription>상세를 볼 수 없어요.</DialogDescription></DialogHeader>
    <StateMessage kind="error">지출을 불러오지 못했어요.</StateMessage>
  </>
  const current = expense
  const base = `${expensesBase(organizationId)}/${encodeURIComponent(current.id)}`
  const editable = finance && !current.voided
  async function run(path: string, body: unknown) {
    setBusy(true)
    setMessage('')
    const result = await sendExpense(`${base}${path}`, 'POST', body)
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return false }
    setExpense(result.expense)
    onChanged()
    return true
  }
  const voidValid = VoidExpenseSchema.safeParse({ version: current.version, reason: voidReason ?? '' }).success
  const comparison = comparisonText(current)
  const fields: [string, string][] = [['결제일', current.paidOn], ['결제 수단', methodLabels[current.method]], ['결제한 사람', current.payer.name],
    ['행사', eventText(current)], ['메모', current.note ?? '—'], ['기록한 사람', current.recordedBy.name]]
  return <>
    <DialogHeader>
      <DialogTitle className="wrap-anywhere">{current.vendor} · {won(current.amount)}</DialogTitle>
      <DialogDescription className="wrap-anywhere">{current.description}</DialogDescription>
    </DialogHeader>
    {current.voided && <StateMessage kind="notice">취소됨 · {current.voided.by.name} · {current.voided.reason}</StateMessage>}
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">{fields.map(([label, value]) => <div key={label} className="contents">
      <dt className="text-gray-500">{label}</dt><dd className="col-span-2 wrap-anywhere text-gray-900">{value}</dd></div>)}</dl>
    {comparison && <p className="text-xs text-gray-700">{comparison}</p>}
    {current.items.length > 0 && <section aria-label="연결 품목" className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">연결 품목 {current.items.length}</h3>
      <ul className="flex flex-col gap-0.5 text-xs text-gray-700">{current.items.map(item => <li key={item.id} className="wrap-anywhere">
        {productNameOf(item)} · {item.quantity === null ? '수량 확인 필요' : `${item.quantity}개`} · {item.requester.name}</li>)}</ul>
    </section>}
    <section aria-label="증빙" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">증빙 {current.receiptCount}</h3>
        <Badge tone={current.evidence === 'complete' ? 'success' : 'warning'}>{current.evidence === 'complete' ? '증빙 완료' : '증빙 누락'}</Badge>
      </div>
      {current.receipts.length ? <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{current.receipts.map(receipt => {
        const url = `${base}/receipts/${encodeURIComponent(receipt.id)}/file`
        return <li key={receipt.id} className="flex min-w-0 flex-col gap-1">
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-col gap-1 text-xs wrap-anywhere text-blue-600 hover:underline">
            {previewable(receipt) ? <img src={url} alt="" loading="lazy" className="aspect-square w-full rounded-md border object-cover" />
              : <FileText aria-hidden className="size-6 text-gray-400" />}
            <span>{kindLabels[receipt.kind]} · {receipt.fileName}</span>
          </a>
          {editable && <Button variant="ghost" size="sm" className="self-start" disabled={busy || uploader.busy}
            onClick={() => void run(`/receipts/${encodeURIComponent(receipt.id)}/delete`, {})}>삭제</Button>}
        </li>
      })}</ul> : <p className="text-sm text-gray-500">올린 증빙이 없어요.</p>}
      {editable && <div className="flex flex-wrap items-end gap-2">
        <Label className="flex flex-col gap-1.5">증빙 종류
          <NativeSelect value={kind} disabled={uploader.busy} onChange={event => setKind(event.target.value as ReceiptKind)}>
            {RECEIPT_KINDS.map(value => <option key={value} value={value}>{kindLabels[value]}</option>)}
          </NativeSelect></Label>
        <Button variant="outline" disabled={uploader.busy || busy} onClick={() => fileInput.current?.click()}><Upload />증빙 추가</Button>
        {/* 카메라와 사진첩을 둘 다 고를 수 있게 capture를 두지 않는다. 버튼이 이 칸을 대신 연다. */}
        <input ref={fileInput} type="file" multiple accept="image/*,application/pdf" className="sr-only" tabIndex={-1} aria-label="증빙 파일 고르기"
          onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; void uploader.upload(files, kind) }} />
      </div>}
      {uploader.uploads.length > 0 && <ul aria-label="올리는 파일" className="flex flex-col gap-0.5 text-xs">{uploader.uploads.map((upload, index) =>
        <li key={index} className={cn('wrap-anywhere', upload.status === 'failed' ? 'text-destructive' : 'text-gray-600')}>
          {upload.name} · {upload.status === 'uploading' ? '올리는 중…' : upload.status === 'done' ? '올렸어요' : upload.message}</li>)}</ul>}
    </section>
    {current.history.length > 0 && <section aria-label="처리 기록" className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">처리 기록</h3>
      <ol className="flex flex-col gap-0.5 text-xs text-gray-600">{current.history.map(entry => <li key={entry.id} className="wrap-anywhere">
        {entry.actor.name} · {timeText(entry.createdAt)} · {historyText(entry)}</li>)}</ol>
    </section>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {editable && (voidReason === null
      ? <DialogFooter>
        {onEdit && <Button variant="outline" disabled={busy} onClick={() => onEdit(current)}>수정</Button>}
        <Button variant="destructive" disabled={busy} onClick={() => setVoidReason('')}>지출 취소</Button>
      </DialogFooter>
      : <div className="flex flex-col gap-2">
        <Label className="flex flex-col gap-1.5">취소 사유<Textarea rows={2} value={voidReason} onChange={event => setVoidReason(event.target.value)} /></Label>
        <p className="text-xs text-gray-500">합계에서 빠지고 연결 품목은 풀려요.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setVoidReason(null)}>돌아가기</Button>
          <Button variant="destructive" disabled={busy || !voidValid}
            onClick={() => void run('/void', { version: current.version, reason: voidReason }).then(done => { if (done) setVoidReason(null) })}>취소하기</Button>
        </div>
      </div>)}
  </>
}
