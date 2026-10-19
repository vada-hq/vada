import { useState, type FormEvent } from 'react'
import { Ellipsis, Plus } from 'lucide-react'
import { CreateDepartmentSchema, UpdateDepartmentSchema, type CouncilView, type TeamDepartment } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import type { Team } from './useTeam'

const errors: Record<string, string> = {
  DEPARTMENT_NAME_TAKEN: '같은 이름의 부서가 있어요.',
  DEPARTMENT_IN_USE: '부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.',
  FORBIDDEN: '권한이 바뀌었어요. 화면을 새로 불러왔어요.',
  NOT_FOUND: '이미 바뀌었어요. 목록을 새로 불러왔어요.',
}
const failure = '저장하지 못했어요. 다시 시도해 주세요.'

// 운영진 > 부서: 이름, 역할(재정), 부서원 수. 회장단은 부서 만들기와 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 본다.
// 없애기는 쓰인 적 없는 부서만 된다(서버가 409로 막는다).
export default function Departments({ view, team }: { view: CouncilView; team: Team }) {
  const { data, loadFailed, saving, change, reload } = team
  const [message, setMessage] = useState('')
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<TeamDepartment | null>(null)
  const [name, setName] = useState('')
  if (!data) return loadFailed
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">부서를 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button></Card>
    : <StateMessage kind="loading">부서 불러오는 중…</StateMessage>
  const current = data
  const manage = view.permissions.includes('department.manage')
  // 버튼은 서버와 같은 스키마로 판단한다.
  const created = CreateDepartmentSchema.safeParse({ name: newName })
  const renamed = renaming ? UpdateDepartmentSchema.safeParse({ name, role: renaming.role }) : null

  async function run(path: string, body: unknown) {
    setMessage('')
    const code = await change(path, body)
    if (code) setMessage(errors[code] ?? failure)
    return code === null
  }
  const departmentPath = (department: TeamDepartment) => `/departments/${encodeURIComponent(department.id)}`
  async function create(event: FormEvent) {
    event.preventDefault()
    if (created.success && await run('/departments', created.data)) setNewName('')
  }
  async function rename(event: FormEvent) {
    event.preventDefault()
    if (renaming && renamed?.success && await run(departmentPath(renaming), renamed.data)) setRenaming(null)
  }

  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    <h2 className="text-base font-semibold text-gray-900">부서 {current.departments.length}개</h2>
    {message && !renaming && <StateMessage kind="error">{message}</StateMessage>}
    <Card className="overflow-hidden">
      {current.departments.length === 0 ? <p className="px-4 py-6 text-sm text-gray-500">아직 부서가 없어요.</p>
        : <ul aria-label="부서" className="divide-y">
          {current.departments.map(department => <li key={department.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">{department.name}
                {department.role === 'finance' && <Badge tone="info">재정</Badge>}</p>
              <p className="text-xs text-gray-500">부서원 {department.memberCount}명</p>
            </div>
            {manage && <Menu>
              <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${department.name} 동작`} disabled={saving}><Ellipsis /></Button></MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => { setMessage(''); setName(department.name); setRenaming(department) }}>이름 바꾸기</MenuItem>
                <MenuItem onSelect={() => { void run(departmentPath(department), { name: department.name, role: department.role === 'finance' ? null : 'finance' }) }}>
                  {department.role === 'finance' ? '재정 역할 거두기' : '재정 역할 주기'}</MenuItem>
                <MenuItem destructive onSelect={() => { void run(`${departmentPath(department)}/delete`, {}) }}>없애기</MenuItem>
              </MenuContent>
            </Menu>}
          </li>)}
        </ul>}
    </Card>
    {manage && <form aria-label="부서 만들기" className="flex gap-2" onSubmit={event => { void create(event) }}>
      <Input aria-label="새 부서 이름" placeholder="새 부서 이름" value={newName} onChange={event => setNewName(event.target.value)} />
      <Button type="submit" variant="outline" disabled={!created.success || saving}><Plus />부서 만들기</Button>
    </form>}
    <Dialog open={renaming !== null} onOpenChange={open => { if (!open && !saving) { setRenaming(null); setMessage('') } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>부서 이름 바꾸기</DialogTitle></DialogHeader>
        <form aria-label="부서 이름 바꾸기" className="flex flex-col gap-4" onSubmit={event => { void rename(event) }}>
          <Label className="flex flex-col gap-2">부서 이름
            <Input value={name} onChange={event => setName(event.target.value)} />
          </Label>
          {message && <StateMessage kind="error">{message}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => { setRenaming(null); setMessage('') }}>취소</Button>
            <Button type="submit" disabled={!renamed?.success || saving}>바꾸기</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
}
