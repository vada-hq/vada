import { useEffect, useState } from 'react'
import { koreanOf, type EventCompletionResponse, type EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { changeCompletion, loadCompletion, staleCompletionCodes } from './completion'
import { eventPhaseOf } from './event-phase'

type Props = { event: EventSummary; onChanged: (event: EventSummary) => void; onStale: () => void }
type Action = 'complete' | 'cancel'

// 행사 화면 머리의 회장단 단추. 완료하지 않은 행사는 [완료하기], 완료한 행사는 [완료 취소]다(EVT-02E).
// 연 때 고른 일은 닫을 때까지 그대로다. 그사이 다른 회장단이 먼저 바꿔 행사 목록을 다시 받아도 반대 단추를 보이지 않는다.
export default function EventCompletionControl({ event, onChanged, onStale }: Props) {
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  return <>
    <Button variant="outline" size="sm" onClick={() => setAction(event.completedAt ? 'cancel' : 'complete')}>{event.completedAt ? '완료 취소' : '완료하기'}</Button>
    <Dialog open={action !== null} onOpenChange={open => { if (!busy && !open) setAction(null) }}>
      <DialogContent>
        {/* 열 때마다 새로 그린다. 정산·업무는 그때 다시 본다. 행사를 다시 받아도 같은 대화상자를 이어 그린다. */}
        {action && <Body key={event.id} action={action} event={event} busy={busy} onBusy={setBusy} onClose={() => setAction(null)}
          onChanged={changed => { setAction(null); onChanged(changed) }} onStale={onStale} />}
      </DialogContent>
    </Dialog>
  </>
}

type BodyProps = Props & { action: Action; busy: boolean; onBusy: (busy: boolean) => void; onClose: () => void }
function Body({ action, event, busy, onBusy, onClose, onChanged, onStale }: BodyProps) {
  const completed = Boolean(event.completedAt)
  // 연 뒤에 다른 회장단이 먼저 같은 일을 했다. 남의 완료를 되돌리지 않게 반대 동작을 보이지 않는다.
  const outdated = action === 'complete' ? completed : !completed
  const [check, setCheck] = useState<EventCompletionResponse | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (action !== 'complete' || outdated) return
    let cancelled = false
    setCheck('loading')
    void loadCompletion(event).then(result => { if (!cancelled) setCheck(result ?? 'error') })
    return () => { cancelled = true }
  }, [event, action, outdated, attempt])
  async function submit() {
    onBusy(true)
    setMessage('')
    const result = await changeCompletion(event, action)
    onBusy(false)
    if (result.ok) { onChanged(result.event); return }
    setMessage(result.message)
    if (typeof result.code === 'string' && staleCompletionCodes.has(result.code)) onStale()
  }
  const title = action === 'complete' ? '행사를 완료할까요?' : '완료를 취소할까요?'
  if (outdated) return <>
    <DialogHeader><DialogTitle>{title}</DialogTitle>
      <DialogDescription>{action === 'complete' ? '다른 회장단이 이미 완료했어요.' : '다른 회장단이 이미 완료를 취소했어요.'}</DialogDescription></DialogHeader>
    <DialogFooter><Button variant="outline" onClick={onClose}>닫기</Button></DialogFooter>
  </>
  if (action === 'cancel') return <>
    <DialogHeader><DialogTitle>{title}</DialogTitle>
      <DialogDescription>다시 대화·업무·구매·참가자·재정을 바꿀 수 있고, 옆 메뉴 행사 목록으로 돌아가요. 정산은 그대로예요.</DialogDescription></DialogHeader>
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy} onClick={() => void submit()}>완료 취소</Button>
    </DialogFooter>
  </>
  const ended = eventPhaseOf(event, koreanOf(new Date())) === 'wrapping'
  return <>
    <DialogHeader><DialogTitle>{title}</DialogTitle>
      <DialogDescription>완료하면 대화·업무·구매·참가자·재정을 바꿀 수 없고, 행사가 "기록"으로 옮겨져요. 기록에서 결과보고서를 써요.
        회장단은 완료를 취소할 수 있어요.</DialogDescription></DialogHeader>
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
