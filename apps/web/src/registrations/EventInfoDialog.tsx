import { useState } from 'react'
import { UpdateEventSchema, type EventSummary, type UpdateEventRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateEvent } from './useRegistration'

type Props = {
  open: boolean
  organizationId: string
  event: EventSummary
  onClose: () => void
  onSaved: (event: EventSummary) => void
  // 남이 먼저 바꿨으면 행사 목록을 다시 받는다.
  onStale: () => void
}

// 와이어프레임 EVT-02B 중 일시·장소. 참가 신청 화면에 그대로 보인다.
export default function EventInfoDialog({ open, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form key={`${props.event.id}:${props.event.version}`} onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Form({ organizationId, event, onClose, onSaved, onStale }: Omit<Props, 'open'>) {
  const [startsAt, setStartsAt] = useState(event.startsAt ?? '')
  const [endsAt, setEndsAt] = useState(event.endsAt ?? '')
  const [place, setPlace] = useState(event.place ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const input: UpdateEventRequest = { version: event.version, startsAt: startsAt || null, endsAt: endsAt || null, place: place.trim() ? place : null }
  // 버튼은 서버와 같은 스키마로 켠다.
  const valid = UpdateEventSchema.safeParse(input).success
  async function save() {
    setBusy(true)
    setMessage('')
    const result = await updateEvent(organizationId, event.id, input)
    setBusy(false)
    if (result.ok) {
      onSaved(result.event)
      return
    }
    setMessage(result.message)
    if (result.code === 'VERSION_CONFLICT') onStale()
  }
  return <>
    <DialogHeader>
      <DialogTitle>행사 정보</DialogTitle>
      <DialogDescription>참가 신청 화면에 보여요. 시각은 한국 시각이에요.</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="flex flex-col gap-1.5">시작
          <Input type="datetime-local" value={startsAt} onChange={item => setStartsAt(item.target.value)} /></Label>
        <Label className="flex flex-col gap-1.5">끝(선택)
          <Input type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={item => setEndsAt(item.target.value)} /></Label>
      </div>
      {endsAt !== '' && startsAt !== '' && endsAt <= startsAt && <p className="text-xs text-destructive">끝은 시작보다 늦어야 해요.</p>}
      <Label className="flex flex-col gap-1.5">장소(선택)<Input value={place} onChange={item => setPlace(item.target.value)} /></Label>
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void save()}>{busy ? '저장하는 중…' : '저장'}</Button>
    </DialogFooter>
  </>
}
