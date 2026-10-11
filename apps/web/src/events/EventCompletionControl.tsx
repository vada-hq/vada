import { useEffect, useState } from 'react'
import { koreanOf, type EventCompletionResponse, type EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { changeCompletion, loadCompletion, staleCompletionCodes } from './completion'
import { eventPhaseOf } from './event-phase'

type Props = { event: EventSummary; onChanged: (event: EventSummary) => void; onStale: () => void }

// 행사 화면 머리의 회장단 단추. 완료하지 않은 행사는 [완료하기], 완료한 행사는 [완료 취소]다(EVT-02E).
export default function EventCompletionControl({ event, onChanged, onStale }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{event.completedAt ? '완료 취소' : '완료하기'}</Button>
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next) }}>
      <DialogContent>
        {/* 열 때마다 새로 그린다. 정산·업무는 그때 다시 본다. */}
        {open && <Body key={`${event.id}:${event.version}`} event={event} busy={busy} onBusy={setBusy} onClose={() => setOpen(false)}
          onChanged={changed => { setOpen(false); onChanged(changed) }} onStale={onStale} />}
      </DialogContent>
    </Dialog>
  </>
}

type BodyProps = Props & { busy: boolean; onBusy: (busy: boolean) => void; onClose: () => void }
function Body({ event, busy, onBusy, onClose, onChanged, onStale }: BodyProps) {
  const completed = Boolean(event.completedAt)
  const [check, setCheck] = useState<EventCompletionResponse | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (completed) return
    let cancelled = false
    setCheck('loading')
    void loadCompletion(event).then(result => { if (!cancelled) setCheck(result ?? 'error') })
    return () => { cancelled = true }
  }, [event, completed, attempt])
  async function submit() {
    onBusy(true)
    setMessage('')
    const result = await changeCompletion(event, completed ? 'cancel' : 'complete')
    onBusy(false)
    if (result.ok) { onChanged(result.event); return }
    setMessage(result.message)
    if (typeof result.code === 'string' && staleCompletionCodes.has(result.code)) onStale()
  }
  if (completed) return <>
    <DialogHeader><DialogTitle>완료를 취소할까요?</DialogTitle>
      <DialogDescription>다시 대화·업무·구매·참가자·재정을 바꿀 수 있고, 옆 메뉴 행사 목록으로 돌아가요. 정산은 그대로예요.</DialogDescription></DialogHeader>
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy} onClick={() => void submit()}>완료 취소</Button>
    </DialogFooter>
  </>
  const ended = eventPhaseOf(event, koreanOf(new Date())) === 'wrapping'
  return <>
    <DialogHeader><DialogTitle>행사를 완료할까요?</DialogTitle>
      <DialogDescription>완료하면 대화·업무·구매·참가자·재정을 바꿀 수 없고, 행사가 "기록"으로 옮겨져요. 회장단은 완료를 취소할 수 있어요.</DialogDescription></DialogHeader>
    {check === 'loading' ? <StateMessage kind="loading">완료할 수 있는지 확인하는 중…</StateMessage>
      : check === 'error' ? <div className="flex flex-wrap items-center gap-2">
        <StateMessage kind="error">완료할 수 있는지 확인하지 못했어요.</StateMessage>
        <Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>다시 확인</Button>
      </div>
      : <div className="flex flex-col gap-2">
        {!check.settled && <Alert tone="warning">재정 탭에서 먼저 정산해 주세요.</Alert>}
        {check.openTasks > 0 && <p className="text-sm text-gray-700">끝나지 않은 업무 {check.openTasks}개는 그대로 남아요.</p>}
        {!ended && <p className="text-sm text-gray-700">아직 행사가 끝나지 않았어요.</p>}
      </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || check === 'loading' || check === 'error' || !check.settled} onClick={() => void submit()}>완료하기</Button>
    </DialogFooter>
  </>
}
