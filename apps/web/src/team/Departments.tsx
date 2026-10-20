import { useEffect, useState, type FormEvent } from 'react'
import { Ellipsis, Plus } from 'lucide-react'
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  type CouncilView,
  type TeamDepartment,
} from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { DEPARTMENT_ERRORS, SAVE_FAILED } from '@/lib/messages'
import { useReveal } from '@/lib/use-reveal'
import { useMenuFocus } from './use-menu-focus'
import type { Team } from './useTeam'

// 같은 요청을 다시 보내도 같은 답이 오는 경우: 화면이 오래됐거나(권한이 바뀜, 부서가 없어짐) 부서원이 있었던 부서다.
const final = new Set(['FORBIDDEN', 'NOT_FOUND', 'DEPARTMENT_IN_USE'])
// 오류를 보일 자리: 만들기 칸 아래, 열린 대화상자 안, 쪽 위.
type Scope = 'create' | 'rename' | 'remove' | 'list'
type Problem = { scope: Scope; text: string }

// 운영진 > 부서: 이름, 역할(재정), 부서원 수. 회장단은 부서 만들기와 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 본다.
// 없애기는 쓰인 적 없는 부서만 된다(서버가 막는다). 되돌리기 어려워 한 번 묻는다.
// 대화상자는 id만 기억하고 매번 다시 읽은 목록에서 부서를 찾는다. 부서가 사라졌거나 권한을 잃으면 닫힌다(DEC-38).
export default function Departments({ view, team }: { view: CouncilView; team: Team }) {
  const { data, loadFailed, saving, change, reload } = team
  const [problem, setProblem] = useState<Problem | null>(null)
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [name, setName] = useState('')
  const menuFocus = useMenuFocus()
  const manage = view.permissions.includes('department.manage')
  const find = (id: string | null) =>
    manage && id !== null
      ? (data?.departments.find(department => department.id === id) ?? null)
      : null
  const renamingDepartment = find(renaming)
  const removingDepartment = find(removing)
  const renamingGone = data !== null && renaming !== null && !renamingDepartment
  const removingGone = data !== null && removing !== null && !removingDepartment
  useEffect(() => {
    if (renamingGone) setRenaming(null)
  }, [renamingGone])
  useEffect(() => {
    if (removingGone) setRemoving(null)
  }, [removingGone])
  const pageProblem = problem?.scope === 'list' ? problem.text : ''
  const problemRef = useReveal<HTMLDivElement>(pageProblem)
  if (!data)
    return loadFailed ? (
      <Card className="flex flex-col gap-3 p-6">
        <StateMessage kind="error">부서를 불러오지 못했어요.</StateMessage>
        <Button variant="outline" className="self-start" onClick={reload}>
          다시 시도
        </Button>
      </Card>
    ) : (
      <StateMessage kind="loading">부서 불러오는 중…</StateMessage>
    )
  const current = data
  // 버튼은 서버와 같은 스키마로 판단한다.
  const created = CreateDepartmentSchema.safeParse({ name: newName })
  const renamed = renamingDepartment
    ? UpdateDepartmentSchema.safeParse({ name, role: renamingDepartment.role })
    : null
  const problemIn = (scope: Scope) => (problem?.scope === scope ? problem.text : '')

  // 실패하면 오류 코드를, 성공하면 null을 돌려준다. 오류는 동작한 자리에 보이고, 다시 보내도 소용없는 오류는 쪽 위에 보인다.
  // 권한이 바뀌었다는 답은 만들기 칸이나 대화상자와 함께 그 자리가 사라질 수 있어 쪽 위에 보인다.
  async function run(path: string, body: unknown, scope: Scope) {
    setProblem(null)
    const code = await change(path, body)
    if (code)
      setProblem({
        scope: final.has(code) ? 'list' : scope,
        text: DEPARTMENT_ERRORS[code] ?? SAVE_FAILED,
      })
    return code
  }
  const departmentPath = (department: TeamDepartment) =>
    `/departments/${encodeURIComponent(department.id)}`
  async function create(event: FormEvent) {
    event.preventDefault()
    if (created.success && !saving && (await run('/departments', created.data, 'create')) === null)
      setNewName('')
  }
  async function rename(event: FormEvent) {
    event.preventDefault()
    if (!renamingDepartment || !renamed?.success || saving) return
    const code = await run(departmentPath(renamingDepartment), renamed.data, 'rename')
    if (code === null || final.has(code)) setRenaming(null)
  }
  async function remove() {
    if (!removingDepartment || saving) return
    const code = await run(`${departmentPath(removingDepartment)}/delete`, {}, 'remove')
    if (code === null || final.has(code)) setRemoving(null)
  }
  const closeRename = () => {
    setRenaming(null)
    setProblem(null)
  }
  const closeRemove = () => {
    setRemoving(null)
    setProblem(null)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">부서 {current.departments.length}개</h2>
      {pageProblem && (
        <div ref={problemRef}>
          <StateMessage kind="error">{pageProblem}</StateMessage>
        </div>
      )}
      <Card className="overflow-hidden">
        {current.departments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">아직 부서가 없어요.</p>
        ) : (
          <ul aria-label="부서" className="divide-y">
            {current.departments.map(department => (
              <li key={department.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">
                    {department.name}
                    {department.role === 'finance' && <Badge tone="info">재정</Badge>}
                  </p>
                  <p className="text-xs text-gray-500">부서원 {department.memberCount}명</p>
                </div>
                {manage && (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        ref={menuFocus.triggerRef(department.id)}
                        variant="ghost"
                        size="icon"
                        aria-label={`${department.name} 동작`}
                        disabled={saving}
                      >
                        <Ellipsis />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem
                        onSelect={() => {
                          setProblem(null)
                          setName(department.name)
                          menuFocus.remember(department.id)
                          setRenaming(department.id)
                        }}
                      >
                        이름 바꾸기
                      </MenuItem>
                      <MenuItem
                        onSelect={() => {
                          void run(
                            departmentPath(department),
                            {
                              name: department.name,
                              role: department.role === 'finance' ? null : 'finance',
                            },
                            'list',
                          )
                        }}
                      >
                        {department.role === 'finance' ? '재정 역할 거두기' : '재정 역할 주기'}
                      </MenuItem>
                      <MenuItem
                        destructive
                        onSelect={() => {
                          setProblem(null)
                          menuFocus.remember(department.id)
                          setRemoving(department.id)
                        }}
                      >
                        없애기
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {manage && (
        <div className="flex flex-col gap-2">
          <form
            aria-label="부서 만들기"
            className="flex gap-2"
            onSubmit={event => {
              void create(event)
            }}
          >
            <Input
              aria-label="새 부서 이름"
              placeholder="새 부서 이름"
              value={newName}
              aria-invalid={problemIn('create') ? true : undefined}
              onChange={event => {
                setNewName(event.target.value)
                if (problem?.scope === 'create') setProblem(null)
              }}
            />
            <Button type="submit" variant="outline" disabled={!created.success || saving}>
              <Plus />
              부서 만들기
            </Button>
          </form>
          {problemIn('create') && <StateMessage kind="error">{problemIn('create')}</StateMessage>}
        </div>
      )}
      <Dialog
        open={renamingDepartment !== null}
        onOpenChange={open => {
          if (!open && !saving) closeRename()
        }}
      >
        <DialogContent onCloseAutoFocus={menuFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>부서 이름 바꾸기</DialogTitle>
          </DialogHeader>
          <form
            aria-label="부서 이름 바꾸기"
            className="flex flex-col gap-4"
            onSubmit={event => {
              void rename(event)
            }}
          >
            <Label className="flex flex-col gap-2">
              부서 이름
              <Input value={name} onChange={event => setName(event.target.value)} />
            </Label>
            {problemIn('rename') && <StateMessage kind="error">{problemIn('rename')}</StateMessage>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={closeRename}>
                취소
              </Button>
              <Button type="submit" disabled={!renamed?.success || saving}>
                바꾸기
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={removingDepartment !== null}
        destructive
        busy={saving}
        error={problemIn('remove')}
        title={`${removingDepartment?.name ?? ''} 부서를 없앨까요?`}
        description="부서원이 있었던 적 없는 부서만 없앨 수 있어요. 없앤 부서는 되돌릴 수 없어요."
        confirmLabel="없애기"
        onCloseAutoFocus={menuFocus.onCloseAutoFocus}
        onCancel={closeRemove}
        onConfirm={() => {
          void remove()
        }}
      />
    </div>
  )
}
