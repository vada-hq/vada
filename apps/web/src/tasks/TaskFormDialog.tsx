import { useState } from 'react'
import { CreateTaskSchema, UpdateTaskSchema, type CreateTaskRequest, type OrganizationMembersResponse, type TaskDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { createTask, updateTask } from './useTasks'

type Props = {
  open: boolean
  organizationId: string
  eventId: string
  // 있으면 수정, 없으면 새 업무다.
  task: TaskDetail | null
  // 부서·담당자 고르기에 쓴다. 불러오는 중이면 null이다.
  directory: OrganizationMembersResponse | null
  directoryError: boolean
  onClose: () => void
  onSaved: (task: TaskDetail) => void
}

// 업무 추가·수정. 담당자는 부서가 있는 구성원만 고른다(서버도 막는다).
export default function TaskFormDialog({ open, task, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form key={task?.id ?? 'new'} task={task} onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Form({ organizationId, eventId, task, directory, directoryError, onClose, onSaved }: Omit<Props, 'open'>) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [departmentId, setDepartmentId] = useState(task?.department?.id ?? '')
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.membershipId ?? '')
  const [dueOn, setDueOn] = useState(task?.dueOn ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const input: CreateTaskRequest = { title, description: description.trim() ? description : null, departmentId: departmentId || null,
    assigneeMembershipId: assigneeId || null, dueOn: dueOn || null }
  // 버튼은 서버와 같은 스키마로 켠다. 길이 숫자를 화면에 다시 적지 않는다.
  const valid = task ? UpdateTaskSchema.safeParse({ ...input, version: task.version }).success : CreateTaskSchema.safeParse(input).success
  const staff = directory?.members.filter(member => member.departmentId !== null) ?? []
  // 맡긴 뒤 미배정이 된 지금 담당자는 목록에 없으므로 따로 넣어 고른 채로 둔다. 목록을 불러오는 동안에는 알 수 없으므로 넣지 않는다.
  const keptAssignee = directory && task?.assignee && !staff.some(member => member.id === task.assignee?.membershipId) ? task.assignee : null
  function chooseAssignee(value: string) {
    setAssigneeId(value)
    const department = staff.find(member => member.id === value)?.departmentId
    if (!departmentId && department) setDepartmentId(department)
  }
  async function save() {
    setBusy(true)
    setMessage('')
    const result = task ? await updateTask(organizationId, eventId, task.id, { ...input, version: task.version })
      : await createTask(organizationId, eventId, input)
    setBusy(false)
    if (result.ok) onSaved(result.task)
    else setMessage(result.message)
  }
  return <>
    <DialogHeader>
      <DialogTitle>{task ? '업무 수정' : '업무 추가'}</DialogTitle>
      <DialogDescription>담당자는 한 명이에요. 검토가 필요하면 검토할 사람에게 업무를 따로 맡겨 주세요.</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3">
      <Label className="flex flex-col gap-1.5">제목<Input value={title} onChange={event => setTitle(event.target.value)} /></Label>
      <Label className="flex flex-col gap-1.5">설명<Textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} /></Label>
      {directoryError ? <StateMessage kind="notice">구성원 목록을 불러오지 못해 담당 부서와 담당자는 고를 수 없어요.</StateMessage>
        : <div className="grid gap-3 sm:grid-cols-2">
          <Label className="flex flex-col gap-1.5">담당 부서
            <NativeSelect value={departmentId} disabled={!directory} onChange={event => setDepartmentId(event.target.value)}>
              <option value="">{directory ? '없음' : '불러오는 중…'}</option>
              {directory?.departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
            </NativeSelect></Label>
          <Label className="flex flex-col gap-1.5">담당자
            <NativeSelect value={assigneeId} disabled={!directory} onChange={event => chooseAssignee(event.target.value)}>
              <option value="">{directory ? '없음' : '불러오는 중…'}</option>
              {directory?.departments.map(department => {
                const people = staff.filter(member => member.departmentId === department.id)
                return people.length ? <optgroup key={department.id} label={department.name}>
                  {people.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</optgroup> : null
              })}
              {keptAssignee && <option value={keptAssignee.membershipId}>{keptAssignee.name} (미배정)</option>}
            </NativeSelect></Label>
        </div>}
      <Label className="flex flex-col gap-1.5">마감일
        <Input type="date" min="2000-01-01" max="2999-12-31" value={dueOn} onChange={event => setDueOn(event.target.value)} /></Label>
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void save()}>{task ? '저장' : '추가'}</Button>
    </DialogFooter>
  </>
}
