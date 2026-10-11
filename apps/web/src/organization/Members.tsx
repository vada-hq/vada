import { useState, type FormEvent } from 'react'
import { Pencil, Plus, UserPlus, Users } from 'lucide-react'
import { CreateDepartmentSchema, UpdateDepartmentSchema, UpdateMemberTitleSchema,
  type DepartmentSummary, type MemberSummary, type UpdateDepartmentRequest } from '@vada/contracts'
import InviteShare from '../access/InviteShare'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { groupMembers, moveWarning, sortDepartments } from './members-view'
import type { OrganizationMembers } from './useOrganizationMembers'

const messages: Record<string, string> = {
  LAST_LEADER: '회장단은 최소 한 명 있어야 해요. 다른 사람을 먼저 회장단으로 옮겨 주세요.',
  DEPARTMENT_NAME_TAKEN: '같은 이름의 부서가 있어요.',
  DEPARTMENT_NOT_EMPTY: '구성원이 있는 부서는 지울 수 없어요. 먼저 다른 부서로 옮겨 주세요.',
  DEPARTMENT_IN_USE: '구매 요청 기록이 있거나 행사를 맡은 부서는 지울 수 없어요. 이름을 바꿔 쓰세요.',
  FORBIDDEN: '회장단만 바꿀 수 있어요.',
  NOT_FOUND: '이미 바뀌었어요. 목록을 새로 불러왔어요.',
}
const failure = '저장하지 못했어요. 다시 시도해 주세요.'
type Move = { member: MemberSummary; to: DepartmentSummary | null; text: string }

// 와이어프레임 ORG-03A·B의 조직도 대신 부서별 목록이다. 휴대폰에서도 쓰고, 끌기 없이 고르는 칸으로 배정한다.
export default function Members({ inviteCode, state }: { inviteCode: string; state: OrganizationMembers }) {
  const { data, loadError, saving, mutate, refresh } = state
  const [message, setMessage] = useState('')
  const [move, setMove] = useState<Move | null>(null)
  const [editing, setEditing] = useState<DepartmentSummary | null>(null)
  const [titling, setTitling] = useState<MemberSummary | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [newName, setNewName] = useState('')
  if (!data) return <div className="p-4 sm:p-6">{loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">구성원을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">구성원 불러오는 중…</StateMessage>}</div>
  const current = data
  const manage = current.viewer.permissions.manageOrganization
  const departments = sortDepartments(current.departments)
  const leaders = current.members.filter(member => departments.some(department => department.isLeadership && department.id === member.departmentId)).length
  const newDepartment = CreateDepartmentSchema.safeParse({ name: newName })

  // 성공하면 true다. 실패하면 문구를 보여 주고, 목록은 서버 값 그대로 두어 고르는 칸이 원래 값으로 돌아간다.
  async function run(method: 'POST' | 'PATCH', path: string, body: unknown) {
    setMessage('')
    const code = await mutate(method, path, body)
    if (code) setMessage(messages[code] ?? failure)
    return code === null
  }
  function assign(member: MemberSummary, to: DepartmentSummary | null) {
    void run('POST', `/members/${encodeURIComponent(member.id)}/department`, { departmentId: to?.id ?? null })
  }
  function choose(member: MemberSummary, value: string) {
    const to = departments.find(department => department.id === value) ?? null
    const from = departments.find(department => department.id === member.departmentId) ?? null
    const text = moveWarning(member, from, to)
    if (text) setMove({ member, to, text })
    else assign(member, to)
  }
  async function addDepartment(event: FormEvent) {
    event.preventDefault()
    if (newDepartment.success && await run('POST', '/departments', newDepartment.data)) setNewName('')
  }
  function openDialog(open: () => void) { setMessage(''); open() }

  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">구성원 {current.members.length}명</h2>
        <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}><UserPlus />초대</Button>
      </div>
      {manage && leaders === 1 && <Alert tone="warning">회장단이 한 명뿐이에요. 자리를 비울 때를 대비해 한 명 더 두세요.</Alert>}
      {current.members.length === 1 && <Card className="flex flex-col gap-4 p-6">
        <EmptyState icon={Users} title="아직 혼자예요" description="링크를 보내 구성원을 모으세요." className="py-4" />
        <InviteShare code={inviteCode} />
      </Card>}
      {message && !editing && !titling && <StateMessage kind="error">{message}</StateMessage>}
      {groupMembers(current.departments, current.members).map(group => {
        const name = group.department?.name ?? '미배정'
        return <Card key={group.key} className="overflow-hidden">
          <section aria-label={name}>
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-semibold wrap-anywhere text-gray-900">{name}</h3>
              <span className="text-xs text-gray-400">{group.members.length}명</span>
              {group.department?.isLeadership && <Badge tone="info">조직 관리</Badge>}
              {(group.department?.isLeadership || group.department?.handlesFinance) && <Badge tone="info">구매 승인</Badge>}
              {!group.department && manage && <Badge tone="warning">배정이 필요해요</Badge>}
              {group.department && manage && <Button variant="ghost" size="icon" className="ml-auto" aria-label={`${name} 편집`}
                onClick={() => openDialog(() => setEditing(group.department))}><Pencil /></Button>}
            </div>
            {group.members.length > 0 && <ul className="divide-y">
              {group.members.map(member => <li key={member.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar />
                  <p className="min-w-0 text-sm wrap-anywhere text-gray-800">{member.name}
                    {member.title && <span className="text-gray-500"> · {member.title}</span>}</p>
                </div>
                {manage && <div className="flex items-center gap-2">
                  <NativeSelect aria-label={`${member.name} 부서`} className="sm:w-40" value={member.departmentId ?? ''} disabled={saving}
                    onChange={event => choose(member, event.target.value)}>
                    <option value="">미배정</option>
                    {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </NativeSelect>
                  <Button variant="outline" size="sm" aria-label={`${member.name} 직책`} disabled={saving}
                    onClick={() => openDialog(() => setTitling(member))}>직책</Button>
                </div>}
              </li>)}
            </ul>}
          </section>
        </Card>
      })}
      {manage && <form className="flex gap-2" onSubmit={event => { void addDepartment(event) }}>
        <Input aria-label="새 부서 이름" placeholder="새 부서 이름" value={newName} onChange={event => setNewName(event.target.value)} />
        <Button type="submit" variant="outline" disabled={!newDepartment.success || saving}><Plus />부서 추가</Button>
      </form>}
    </div>
    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>구성원 초대</DialogTitle>
          <DialogDescription>링크나 코드를 공유하면 학생회에 참여할 수 있어요. 참여한 사람은 미배정으로 등록돼요.</DialogDescription></DialogHeader>
        <InviteShare code={inviteCode} />
      </DialogContent>
    </Dialog>
    <Dialog open={move !== null} onOpenChange={open => { if (!open) setMove(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>부서를 옮길까요?</DialogTitle><DialogDescription>{move?.text}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMove(null)}>취소</Button>
          <Button onClick={() => { if (move) assign(move.member, move.to); setMove(null) }}>옮기기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {editing && <DepartmentDialog key={editing.id} department={editing} saving={saving} error={message}
      memberCount={current.members.filter(member => member.departmentId === editing.id).length} onClose={() => setEditing(null)}
      onSave={input => { void run('PATCH', `/departments/${encodeURIComponent(editing.id)}`, input).then(done => { if (done) setEditing(null) }) }}
      onDelete={() => { void run('POST', `/departments/${encodeURIComponent(editing.id)}/delete`, {}).then(done => { if (done) setEditing(null) }) }} />}
    {titling && <TitleDialog key={titling.id} member={titling} saving={saving} error={message} onClose={() => setTitling(null)}
      onSave={title => { void run('POST', `/members/${encodeURIComponent(titling.id)}/title`, { title }).then(done => { if (done) setTitling(null) }) }} />}
  </div>
}

function DepartmentDialog({ department, memberCount, saving, error, onSave, onDelete, onClose }: {
  department: DepartmentSummary; memberCount: number; saving: boolean; error: string
  onSave: (input: UpdateDepartmentRequest) => void; onDelete: () => void; onClose: () => void
}) {
  const [name, setName] = useState(department.name)
  const [finance, setFinance] = useState(department.handlesFinance)
  const parsed = UpdateDepartmentSchema.safeParse({ name, handlesFinance: finance })
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{department.isLeadership ? '회장단 편집' : '부서 편집'}</DialogTitle>
        <DialogDescription>{department.isLeadership ? '회장단은 지울 수 없고 이름만 바꿀 수 있어요.' : '구매 승인을 켜면 이 부서 사람도 구매요청을 승인해요.'}</DialogDescription>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); if (parsed.success) onSave(parsed.data) }}>
        <Label className="flex flex-col gap-2">이름<Input value={name} onChange={event => setName(event.target.value)} /></Label>
        {!department.isLeadership && <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="size-4 accent-blue-600" checked={finance} onChange={event => setFinance(event.target.checked)} />구매 승인</label>}
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          {!department.isLeadership && memberCount === 0 && <Button type="button" variant="destructive" className="mr-auto" disabled={saving}
            onClick={onDelete}>부서 삭제</Button>}
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={!parsed.success || saving}>저장</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

function TitleDialog({ member, saving, error, onSave, onClose }: {
  member: MemberSummary; saving: boolean; error: string; onSave: (title: string | null) => void; onClose: () => void
}) {
  const [title, setTitle] = useState(member.title ?? '')
  // 비우고 저장하면 직책을 지운다.
  const parsed = UpdateMemberTitleSchema.safeParse({ title: title.trim() ? title : null })
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{member.name} 직책</DialogTitle><DialogDescription>비우고 저장하면 직책을 지워요.</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); if (parsed.success) onSave(parsed.data.title) }}>
        <Label className="flex flex-col gap-2">직책<Input value={title} placeholder="예: 회장, 국장, 총무" onChange={event => setTitle(event.target.value)} /></Label>
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={!parsed.success || saving}>저장</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
