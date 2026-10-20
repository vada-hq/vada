import type { CouncilView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useReveal } from '@/lib/use-reveal'
import { DepartmentCreateForm } from './DepartmentCreateForm'
import { DepartmentDialogs } from './DepartmentDialogs'
import { DepartmentRow } from './DepartmentRow'
import { useDepartments, type DepartmentsState } from './useDepartments'
import type { Team } from './useTeam'

// 운영진 > 부서: 이름, 역할(재정), 부서원 수. 회장단은 부서 만들기와 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 본다.
// 없애기는 쓰인 적 없는 부서만 된다(서버가 막는다). 되돌리기 어려워 한 번 묻는다.
export default function Departments({ view, team }: { view: CouncilView; team: Team }) {
  const state = useDepartments(view, team)
  const pageProblem = state.problemIn('list')
  const problemRef = useReveal<HTMLDivElement>(pageProblem)
  if (!team.data)
    return team.loadFailed ? (
      <Card className="flex flex-col gap-3 p-6">
        <StateMessage kind="error">부서를 불러오지 못했어요.</StateMessage>
        <Button variant="outline" className="self-start" onClick={team.reload}>
          다시 시도
        </Button>
      </Card>
    ) : (
      <StateMessage kind="loading">부서 불러오는 중…</StateMessage>
    )
  const { departments } = team.data

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">부서 {departments.length}개</h2>
      {pageProblem && (
        <div ref={problemRef}>
          <StateMessage kind="error">{pageProblem}</StateMessage>
        </div>
      )}
      <Card className="overflow-hidden">
        <DepartmentList departments={departments} state={state} saving={team.saving} />
      </Card>
      {state.manage && (
        <DepartmentCreateForm
          saving={team.saving}
          error={state.problemIn('create')}
          name={state.newName}
          onName={state.setNewName}
          onCreate={state.create}
          onEdit={state.clearCreateProblem}
        />
      )}
      <DepartmentDialogs state={state} saving={team.saving} />
    </div>
  )
}

type ListProps = {
  departments: NonNullable<Team['data']>['departments']
  state: DepartmentsState
  saving: boolean
}

function DepartmentList({ departments, state, saving }: ListProps) {
  if (departments.length === 0)
    return <p className="px-4 py-6 text-sm text-gray-500">아직 부서가 없어요.</p>
  return (
    <ul aria-label="부서" className="divide-y">
      {departments.map(department => (
        <DepartmentRow
          key={department.id}
          department={department}
          manage={state.manage}
          saving={saving}
          triggerRef={state.menuFocus.triggerRef(department.id)}
          onRename={() => state.openRename(department)}
          onToggleFinance={() => state.toggleFinance(department)}
          onRemove={() => state.openRemove(department)}
        />
      ))}
    </ul>
  )
}
