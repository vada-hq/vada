import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { CouncilView, TeamDepartment, TeamMember } from '@vada/contracts'
import type { Reading } from '@/lib/use-lost'
import { useReveal } from '@/lib/use-reveal'
import { pageState } from '@/lib/app-location'
import PageActions from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DepartmentAdd } from './DepartmentAdd'
import { DepartmentDialogs } from './DepartmentDialogs'
import { DepartmentColorDialog } from './DepartmentColorDialog'
import { DepartmentMenu } from './DepartmentMenu'
import { DepartmentRename } from './DepartmentRename'
import { InviteSheet, InviteSheetBody } from './InviteSheet'
import { MemberRow } from './MemberRow'
import MemberDepartmentsDialog from './MemberDepartmentsDialog'
import { OrgLayout } from './OrgLayout'
import { rowActions } from './people-access'
import { PeopleConfirmDialogs } from './PeopleConfirmDialogs'
import { useDepartments, type DepartmentsState } from './useDepartments'
import { usePeople, type PeopleState } from './usePeople'
import type { Team } from './useTeam'

// reading은 view를 가져온 학생회 읽기다. onCouncilChanged는 바깥 변경을 알게 돼(403) 학생회를 다시 읽고,
// onOwnChange는 내 직급이 바뀐 요청이 성공해 다시 읽는다. 그 다시 읽기로 줄어든 권한은 알리지 않는다.
type Props = {
  view: CouncilView
  reading: Reading
  team: Team
  onCouncilChanged: () => void
  onOwnChange: () => void
}

// 조직(DEC-91): 사람과 부서를 한 화면에서 본다. 모든 운영진이 회장단과 부서별 사람을 보고, 회장단은 그 자리에서 부서를 고친다.
// 사람 줄의 ⋯ 메뉴(부서 배정, 직급, 회장 넘기기, 내보내기)는 사람 화면의 것 그대로다. 회장단은 머리글의 [구성원 초대]로 초대 창을 연다.
// 동작 버튼은 서버가 준 내 권한 목록으로만 보이거나 숨긴다(DEC-38). 대화상자는 대상이 목록에 있고 권한이 있을 때만 열려 있다.
export default function Organization({
  view,
  reading,
  team,
  onCouncilChanged,
  onOwnChange,
}: Props) {
  const people = usePeople({ view, reading }, team, onOwnChange)
  const departments = useDepartments(view, team, reading)
  if (!team.data) return <LoadState failed={team.loadFailed} onRetry={team.reload} />
  const titles = view.council.titles
  // 권한을 잃으면 사람 쪽과 부서 쪽이 같은 까닭을 함께 알린다. 같은 글은 한 번만 보인다.
  const messages = [...new Set([people.pageMessage, departments.problemIn('list')])].filter(Boolean)
  return (
    <PageColumn>
      {people.can('invite.manage') && (
        <Invite councilId={view.council.id} onForbidden={onCouncilChanged} />
      )}
      {messages.map(text => (
        <PageMessage key={text} text={text} />
      ))}
      <OrgLayout
        members={team.data.members}
        departments={team.data.departments}
        titles={titles}
        unassignedFirst={people.can('member.manage')}
        focusFinance={pageState() === 'finance'}
        person={(member, group) => (
          <PersonRow key={member.id} member={member} group={group} {...{ people, team, view }} />
        )}
        {...departmentSlots(departments, team.saving)}
      />
      <Dialogs people={people} departments={departments} view={view} team={team} />
    </PageColumn>
  )
}

// 부서 묶음 머리의 ⋯ 메뉴와 제자리 이름 바꾸기, 목록 끝 [부서 추가]. 부서를 고칠 수 없으면(department.manage) 셋 다 없다.
function departmentSlots(state: DepartmentsState, saving: boolean) {
  return {
    departmentAction: (department: TeamDepartment) =>
      state.manage && (
        <DepartmentMenu
          department={department}
          saving={saving}
          triggerRef={state.menuFocus.triggerRef(department.id)}
          onRename={() => state.openRename(department)}
          onColor={() => state.color.open(department)}
          onToggleFinance={() => state.toggleFinance(department)}
          onRemove={() => state.openRemove(department)}
        />
      ),
    departmentEditor: (department: TeamDepartment) =>
      state.renamingDepartment?.id === department.id && (
        <DepartmentRename
          department={department}
          name={state.name}
          error={state.problemIn('rename')}
          saving={saving}
          onName={name => {
            state.setName(name)
            state.clearRenameProblem()
          }}
          onSubmit={event => {
            void state.rename(event)
          }}
          onClose={state.closeRename}
        />
      ),
    add: state.manage && (
      <DepartmentAdd
        open={state.adding}
        onOpen={() => state.setAdding(true)}
        onClose={() => {
          state.setAdding(false)
          state.clearCreateProblem()
        }}
        saving={saving}
        error={state.problemIn('create')}
        name={state.newName}
        onName={state.setNewName}
        onCreate={state.create}
        onEdit={state.clearCreateProblem}
      />
    ),
  }
}

type RowProps = {
  member: TeamMember
  // 줄이 든 묶음. 겸직자는 묶음마다 줄이 있어 닫은 뒤 초점을 연 묶음의 줄로 돌려준다.
  group: string
  people: PeopleState
  team: Team
  view: CouncilView
}

function PersonRow({ member, group, people, team, view }: RowProps) {
  const key = `${group}:${member.id}`
  return (
    <MemberRow
      member={member}
      departments={team.data?.departments ?? []}
      titles={view.council.titles}
      inDepartment={team.data?.departments.some(item => item.id === group) ? group : null}
      actions={rowActions(member, people.me, people.can)}
      saving={team.saving}
      triggerRef={people.menuFocus.triggerRef(key)}
      onAssign={() => people.openAssign(member, key)}
      // '{부회장} 해제'는 그 줄이 회장단 묶음에서 빠져 초점이 body로 떨어진다. 조각 5(묶음 머리의 부회장 지정)에서 고친다.
      onToggleRank={() => people.toggleViceRank(member)}
      onTransfer={() => people.askConfirm('transfer', member, key)}
      onRemove={() => people.askConfirm('remove', member, key)}
    />
  )
}

type DialogProps = {
  people: PeopleState
  departments: DepartmentsState
  view: CouncilView
  team: Team
}

function Dialogs({ people, departments, view, team }: DialogProps) {
  return (
    <>
      <AssignDialog people={people} view={view} team={team} />
      <PeopleConfirmDialogs
        confirming={people.confirming}
        titles={view.council.titles}
        saving={team.saving}
        error={people.message}
        onCloseAutoFocus={people.menuFocus.onCloseAutoFocus}
        onClose={people.cancelConfirm}
        onConfirm={() => {
          void people.confirmed()
        }}
      />
      <DepartmentDialogs state={departments} saving={team.saving} />
      {departments.color.department && (
        <DepartmentColorDialog
          department={departments.color.department}
          color={departments.color.color}
          saving={team.saving}
          error={departments.problemIn('color')}
          onColor={departments.color.setColor}
          onSave={() => void departments.color.save()}
          onClose={departments.color.close}
          onCloseAutoFocus={departments.menuFocus.onCloseAutoFocus}
        />
      )}
    </>
  )
}

function AssignDialog({ people, view, team }: Omit<DialogProps, 'departments'>) {
  const member = people.editingMember
  if (!member || !team.data) return null
  return (
    <MemberDepartmentsDialog
      key={member.id}
      member={member}
      departments={team.data.departments}
      titles={view.council.titles}
      saving={team.saving}
      canRank={people.can('rank.manage')}
      error={people.message}
      onClose={people.closeAssign}
      onCloseAutoFocus={people.menuFocus.onCloseAutoFocus}
      onAssign={(departmentId, rank) => people.assign(member, departmentId, rank)}
      onRemove={departmentId => people.removeFrom(member, departmentId)}
    />
  )
}

// 회장단에게만 머리글의 [구성원 초대]와 그 창(DEC-47, DEC-91). 권한을 잃으면 둘 다 사라진다.
function Invite({ councilId, onForbidden }: { councilId: string; onForbidden: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PageActions>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <UserPlus aria-hidden />
          구성원 초대
        </Button>
      </PageActions>
      <InviteSheet open={open} onOpenChange={setOpen}>
        <InviteSheetBody councilId={councilId} onForbidden={onForbidden} />
      </InviteSheet>
    </>
  )
}

function LoadState({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (!failed) return <StateMessage kind="loading">조직 불러오는 중…</StateMessage>
  return (
    <Card className="flex flex-col gap-3 p-6">
      <StateMessage kind="error">조직을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={onRetry}>
        다시 시도
      </Button>
    </Card>
  )
}

// 문구가 쪽에 나타나면 화면 안으로 스크롤한다(긴 목록의 먼 줄에서 한 동작의 결과일 수 있다).
function PageMessage({ text }: { text: string }) {
  const ref = useReveal<HTMLDivElement>(text)
  return (
    <div ref={ref}>
      <StateMessage kind="error">{text}</StateMessage>
    </div>
  )
}
