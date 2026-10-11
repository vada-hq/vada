import { useState } from 'react'
import { UpdateEventSchema, type EventSummary, type UpdateEventRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { useOrganizationMembers } from '../organization/useOrganizationMembers'
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

// 와이어프레임 EVT-02B 중 일시·장소와 담당 부서·책임자(M5b). 일시·장소는 참가 신청 화면에 그대로 보인다.
export default function EventInfoDialog({ open, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form key={`${props.event.id}:${props.event.version}`} onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Form({ organizationId, event, onClose, onSaved, onStale }: Omit<Props, 'open'>) {
  const [startsAt, setStartsAt] = useState(event.startsAt ?? '')
  const [endsAt, setEndsAt] = useState(event.endsAt ?? '')
  const [place, setPlace] = useState(event.place ?? '')
  const [departmentId, setDepartmentId] = useState(event.ownerDepartment?.id ?? '')
  const [ownerId, setOwnerId] = useState(event.owner?.membershipId ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  // 부서·책임자 고르기에 쓴다. 대화상자를 연 동안만 불러온다.
  const directory = useOrganizationMembers(organizationId, true)
  // 책임자는 부서가 있는 구성원만 고른다(서버도 막는다).
  const staff = directory.data?.members.filter(member => member.departmentId !== null) ?? []
  // 맡긴 뒤 미배정이 된 지금 책임자는 목록에 없으므로 따로 넣어 고른 채로 둔다. 목록을 불러오는 동안에는 알 수 없으므로 넣지 않는다.
  const keptOwner = directory.data && event.owner && !staff.some(member => member.id === event.owner?.membershipId) ? event.owner : null
  const input: UpdateEventRequest = { version: event.version, startsAt: startsAt || null, endsAt: endsAt || null, place: place.trim() ? place : null,
    ownerDepartmentId: departmentId || null, ownerMembershipId: ownerId || null }
  // 버튼은 서버와 같은 스키마로 켠다.
  const valid = UpdateEventSchema.safeParse(input).success
  // 책임자를 고르면 담당 부서가 비어 있을 때 그 사람 부서로 채운다(업무 추가와 같다).
  function chooseOwner(value: string) {
    setOwnerId(value)
    const department = staff.find(member => member.id === value)?.departmentId
    if (!departmentId && department) setDepartmentId(department)
  }
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
    // 고른 부서·구성원이 바뀌었다. 목록을 새로 받는다.
    if (result.code === 'EVENT_DEPARTMENT_INVALID' || result.code === 'EVENT_OWNER_INVALID') directory.refresh()
  }
  return <>
    <DialogHeader>
      <DialogTitle>행사 정보</DialogTitle>
      <DialogDescription>일시·장소는 참가 신청 화면에 보여요. 시각은 한국 시각이에요.</DialogDescription>
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
      {directory.loadError ? <StateMessage kind="notice">구성원 목록을 불러오지 못해 담당은 고를 수 없어요.</StateMessage>
        : <div className="grid gap-3 sm:grid-cols-2">
          <Label className="flex flex-col gap-1.5">담당 부서(선택)
            <NativeSelect value={departmentId} disabled={!directory.data} onChange={item => setDepartmentId(item.target.value)}>
              <option value="">{directory.data ? '없음' : '불러오는 중…'}</option>
              {directory.data?.departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
            </NativeSelect></Label>
          <Label className="flex flex-col gap-1.5">책임자(선택)
            <NativeSelect value={ownerId} disabled={!directory.data} onChange={item => chooseOwner(item.target.value)}>
              <option value="">{directory.data ? '없음' : '불러오는 중…'}</option>
              {directory.data?.departments.map(department => {
                const people = staff.filter(member => member.departmentId === department.id)
                return people.length ? <optgroup key={department.id} label={department.name}>
                  {people.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</optgroup> : null
              })}
              {keptOwner && <option value={keptOwner.membershipId}>{keptOwner.name} (미배정)</option>}
            </NativeSelect></Label>
        </div>}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void save()}>{busy ? '저장하는 중…' : '저장'}</Button>
    </DialogFooter>
  </>
}
