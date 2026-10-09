import { useEffect, useState } from 'react'
import { VoidIncomeSchema, type IncomeDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { timeText, won } from '../purchases/purchase-view'
import { incomeHistoryText } from './income-view'
import { fetchIncome, voidIncome } from './useIncomes'

type Props = {
  organizationId: string
  periodId: string
  incomeId: string | null
  finance: boolean
  onClose: () => void
  // 취소로 수입이 바뀌면 편성을 새로 불러오게 알린다.
  onChanged: () => void
  onEdit: (income: IncomeDetail) => void
}

// 수입 상세. 처리 기록을 보여 주고, 재정 권한자는 고치거나 취소한다.
export default function IncomeDetailDialog({ incomeId, onClose, ...props }: Props) {
  return <Dialog open={incomeId !== null} onOpenChange={open => { if (!open) onClose() }}>
    {incomeId && <DialogContent><Detail key={incomeId} incomeId={incomeId} {...props} /></DialogContent>}
  </Dialog>
}

function Detail({ organizationId, periodId, incomeId, finance, onChanged, onEdit }: Omit<Props, 'incomeId' | 'onClose'> & { incomeId: string }) {
  const [income, setIncome] = useState<IncomeDetail | null | undefined>(undefined)
  const [voidReason, setVoidReason] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    void fetchIncome(organizationId, periodId, incomeId).then(value => { if (current) setIncome(value) })
    return () => { current = false }
  }, [organizationId, periodId, incomeId])
  if (income === undefined) return <>
    <DialogHeader><DialogTitle>수입</DialogTitle><DialogDescription>불러오는 중…</DialogDescription></DialogHeader>
    <StateMessage kind="loading">불러오는 중…</StateMessage>
  </>
  if (income === null) return <>
    <DialogHeader><DialogTitle>수입</DialogTitle><DialogDescription>상세를 볼 수 없어요.</DialogDescription></DialogHeader>
    <StateMessage kind="error">수입을 불러오지 못했어요.</StateMessage>
  </>
  const current = income
  const editable = finance && !current.voided
  const voidValid = VoidIncomeSchema.safeParse({ version: current.version, reason: voidReason ?? '' }).success
  async function cancel() {
    setBusy(true)
    setMessage('')
    const result = await voidIncome(organizationId, periodId, current.id, { version: current.version, reason: voidReason ?? '' })
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    setIncome(result.income)
    setVoidReason(null)
    onChanged()
  }
  const fields: [string, string][] = [['수입 항목', current.budgetLine?.name ?? '—'], ['메모', current.note ?? '—'], ['기록한 사람', current.recordedBy.name]]
  return <>
    <DialogHeader>
      <DialogTitle className="wrap-anywhere">{current.description} · {won(current.amount)}</DialogTitle>
      <DialogDescription>받은 날 {current.receivedOn}</DialogDescription>
    </DialogHeader>
    {current.voided && <StateMessage kind="notice">취소됨 · {current.voided.by.name} · {current.voided.reason}</StateMessage>}
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">{fields.map(([label, value]) => <div key={label} className="contents">
      <dt className="text-gray-500">{label}</dt><dd className="col-span-2 wrap-anywhere text-gray-900">{value}</dd></div>)}</dl>
    {current.history.length > 0 && <section aria-label="처리 기록" className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">처리 기록</h3>
      <ol className="flex flex-col gap-0.5 text-xs text-gray-600">{current.history.map(entry => <li key={entry.id} className="wrap-anywhere">
        {entry.actor.name} · {timeText(entry.createdAt)} · {incomeHistoryText(entry)}</li>)}</ol>
    </section>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {editable && (voidReason === null
      ? <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={() => onEdit(current)}>수정</Button>
        <Button variant="destructive" disabled={busy} onClick={() => setVoidReason('')}>수입 취소</Button>
      </DialogFooter>
      : <div className="flex flex-col gap-2">
        <Label className="flex flex-col gap-1.5">취소 사유<Textarea rows={2} value={voidReason} onChange={event => setVoidReason(event.target.value)} /></Label>
        <p className="text-xs text-gray-500">합계에서 빠져요.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setVoidReason(null)}>돌아가기</Button>
          <Button variant="destructive" disabled={busy || !voidValid} onClick={() => void cancel()}>취소하기</Button>
        </div>
      </div>)}
  </>
}
