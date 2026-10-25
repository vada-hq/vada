// oxlint-disable max-lines -- 조직도 카드와 상호작용을 한 모듈에서 함께 유지한다.
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'
import { Star, UserPlus, UserRound, X } from 'lucide-react'
import type { CouncilView } from '@vada/contracts'
import type { DepartmentRank } from '@vada/contracts'
import InviteCard from './InviteCard'
import MemberDepartmentsDialog from './MemberDepartmentsDialog'
import { DepartmentCreateForm } from './DepartmentCreateForm'
import { DepartmentDialogs } from './DepartmentDialogs'
import { DepartmentRow } from './DepartmentRow'
import { useDepartments, type DepartmentsState } from './useDepartments'
import { PEOPLE_ERRORS, SAVE_FAILED } from '@/lib/messages'
import PageActions from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { NativeSelect } from '@/components/ui/native-select'
import { departmentRankLabel, councilRankLabel } from './team-view'
import type { Team } from './useTeam'

const FOUR_COLUMNS = 4
const POSITION_STEP = 2
const PERCENT = 100
const CENTER_PERCENT = 50

type Props = {
  view: CouncilView
  team: Team
}

const MemberSelectionContext = createContext<{
  onSelect: (member: TeamMember) => void
}>({ onSelect: () => undefined })

/* oxlint-disable complexity -- 조직도와 구성원·부서 관리 상태를 한 화면에 연결한다. */
// oxlint-disable-next-line max-lines-per-function -- 조직도와 단일 화면 관리 대화상자를 함께 연결한다.
export default function Organization({ view, team }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [departmentManageOpen, setDepartmentManageOpen] = useState(false)
  const [unassignedOpen, setUnassignedOpen] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [managementError, setManagementError] = useState('')
  const [pendingAssignment, setPendingAssignment] = useState<{
    member: TeamMember
    departmentId: string
    rank: DepartmentRank | null
  } | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [viceRemoval, setViceRemoval] = useState<TeamMember | null>(null)
  const [viceAssignmentOpen, setViceAssignmentOpen] = useState(false)
  const [viceAssignmentTargetId, setViceAssignmentTargetId] = useState('')
  const [headAssignmentDepartmentId, setHeadAssignmentDepartmentId] = useState<string | null>(null)
  const [headAssignmentTargetId, setHeadAssignmentTargetId] = useState('')
  const departmentState = useDepartments(view, team)
  if (!team.data) {
    return team.loadFailed ? (
      <Card className="flex flex-col gap-3 p-6">
        <StateMessage kind="error">조직을 불러오지 못했어요.</StateMessage>
        <Button variant="outline" className="self-start" onClick={team.reload}>
          다시 시도
        </Button>
      </Card>
    ) : (
      <StateMessage kind="loading">조직 불러오는 중…</StateMessage>
    )
  }

  const { members, departments } = team.data
  const presidents = members.filter(member => member.councilRank !== null)
  const unassigned = members.filter(
    member => member.councilRank === null && member.departments.length === 0,
  )
  const editingMember = editingMemberId
    ? members.find(member => member.id === editingMemberId) ?? null
    : null
  const selectedMember = selectedMemberId
    ? members.find(member => member.id === selectedMemberId) ?? null
    : null
  const saveManagementChange = async (path: string, body: unknown) => {
    setManagementError('')
    const code = await team.change(path, body)
    if (code) setManagementError(PEOPLE_ERRORS[code] ?? SAVE_FAILED)
  }
  const assign = (member: TeamMember, departmentId: string, rank: DepartmentRank | null) => {
    if (
      member.departments.length > 0 &&
      !member.departments.some(department => department.id === departmentId)
    ) {
      setPendingAssignment({ member, departmentId, rank })
      return
    }
    void saveManagementChange(`/members/${encodeURIComponent(member.id)}/departments`, {
      departmentId,
      rank,
    })
  }
  const changeViceRank = async () => {
    if (!viceRemoval) return
    await saveManagementChange(`/members/${encodeURIComponent(viceRemoval.id)}/rank`, { rank: null })
    setViceRemoval(null)
  }
  const assignViceRank = async () => {
    if (!viceAssignmentTargetId) return
    await saveManagementChange(
      `/members/${encodeURIComponent(viceAssignmentTargetId)}/rank`,
      { rank: 'vice_president' },
    )
    setViceAssignmentOpen(false)
    setViceAssignmentTargetId('')
  }
  const transferPresident = async () => {
    if (!transferTargetId) return
    await saveManagementChange('/president/transfer', { memberId: transferTargetId })
    setTransferOpen(false)
    setTransferTargetId('')
  }
  const removeFrom = (member: TeamMember, departmentId: string) => {
    void saveManagementChange(
      `/members/${encodeURIComponent(member.id)}/departments/${encodeURIComponent(departmentId)}/remove`,
      {},
    )
  }
  return (
    <PageColumn>
      {(view.permissions.includes('invite.manage') ||
        view.permissions.includes('department.manage') ||
        view.permissions.includes('member.manage')) && (
        <PageActions>
          {view.permissions.includes('member.manage') && (
            <Button
              variant="outline"
              size="sm"
              aria-expanded={unassignedOpen}
              aria-controls="unassigned-members-panel"
              className={
                unassignedOpen
                  ? 'border-primary bg-accent text-accent-foreground hover:bg-accent'
                  : undefined
              }
              onClick={() => setUnassignedOpen(open => !open)}
            >
              부서에 없는 구성원
              <span className="text-gray-500">({unassigned.length})</span>
            </Button>
          )}
          {view.permissions.includes('department.manage') && (
            <Button
              variant="outline"
              size="sm"
              aria-expanded={departmentManageOpen}
              aria-controls="department-management-panel"
              className={
                departmentManageOpen
                  ? 'border-primary bg-accent text-accent-foreground hover:bg-accent'
                  : undefined
              }
              onClick={() => setDepartmentManageOpen(open => !open)}
            >
              부서 관리
            </Button>
          )}
          {view.permissions.includes('invite.manage') && (
            <Button
              variant="outline"
              size="sm"
              aria-expanded={inviteOpen}
              aria-controls="invite-management-panel"
              className={
                inviteOpen
                  ? 'border-primary bg-accent text-accent-foreground hover:bg-accent'
                  : undefined
              }
              onClick={() => setInviteOpen(open => !open)}
            >
              <UserPlus />
              구성원 초대
            </Button>
          )}
        </PageActions>
      )}
      {view.permissions.includes('member.manage') && (
        <UnassignedMembersPanel
          open={unassignedOpen}
          members={unassigned}
          onManageMember={member => {
            setManagementError('')
            setEditingMemberId(member.id)
          }}
        />
      )}
      {view.permissions.includes('department.manage') && (
        <DepartmentManagementPanel
          open={departmentManageOpen}
          state={departmentState}
          departments={departments}
          saving={team.saving}
        />
      )}
      {view.permissions.includes('invite.manage') && (
        <InviteManagementPanel
          open={inviteOpen}
          councilId={view.council.id}
          onForbidden={team.reload}
        />
      )}
      <MemberSelectionContext.Provider value={{ onSelect: member => setSelectedMemberId(member.id) }}>
        <OrganizationChart
          members={members}
          presidents={presidents}
          departments={departments}
          titles={view.council.titles}
          canManage={view.permissions.includes('member.manage')}
          canTransfer={view.permissions.includes('president.transfer')}
          canRank={view.permissions.includes('rank.manage')}
          onManageMember={member => {
            setManagementError('')
            setEditingMemberId(member.id)
          }}
          onAssignHead={departmentId => {
            setHeadAssignmentDepartmentId(departmentId)
            setHeadAssignmentTargetId(members[0]?.id ?? '')
          }}
          onTransfer={() => {
              setTransferTargetId(members.find(member => member.councilRank !== 'president')?.id ?? '')
              setTransferOpen(true)
          }}
          onRemoveVice={setViceRemoval}
          onAssignVice={() => {
            setViceAssignmentTargetId(
              members.find(member => member.councilRank === null)?.id ?? '',
            )
            setViceAssignmentOpen(true)
          }}
        />
      </MemberSelectionContext.Provider>
      {selectedMember && (
        <MemberDetailsPanel
          member={selectedMember}
          departments={departments}
          titles={view.council.titles}
          canManage={view.permissions.includes('member.manage')}
          transferable={view.permissions.includes('president.transfer') && selectedMember.councilRank === 'president'}
          removableVice={view.permissions.includes('rank.manage') && selectedMember.councilRank === 'vice_president'}
          onTransfer={() => {
            setTransferTargetId(members.find(member => member.councilRank !== 'president')?.id ?? '')
            setTransferOpen(true)
          }}
          onRemoveVice={() => setViceRemoval(selectedMember)}
          onManage={() => {
            setManagementError('')
            setEditingMemberId(selectedMember.id)
          }}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
      {editingMember && view.permissions.includes('member.manage') && (
        <MemberDepartmentsDialog
          key={editingMember.id}
          member={editingMember}
          departments={departments}
          titles={view.council.titles}
          saving={team.saving}
          canRank={view.permissions.includes('rank.manage')}
          error={managementError}
          onAssign={(departmentId, rank) => assign(editingMember, departmentId, rank)}
          onRemove={departmentId => removeFrom(editingMember, departmentId)}
          onClose={() => {
            setEditingMemberId(null)
            setManagementError('')
          }}
        />
      )}
      <ConfirmDialog
        open={pendingAssignment !== null}
        title="두 번째 직책을 맡길까요?"
        description="이 인원은 직책이 2개입니다. 확인하셨습니까?"
        confirmLabel="두 번째 직책 맡기기"
        busy={team.saving}
        error={managementError}
        onCancel={() => setPendingAssignment(null)}
        onConfirm={() => {
          if (!pendingAssignment) return
          const { member, departmentId, rank } = pendingAssignment
          setPendingAssignment(null)
          void saveManagementChange(`/members/${encodeURIComponent(member.id)}/departments`, {
            departmentId,
            rank,
          })
        }}
      />
      <ConfirmDialog
        open={headAssignmentDepartmentId !== null}
        title="부장 직책을 지정할까요?"
        description="선택한 구성원에게 부장 직책을 지정해요."
        confirmLabel="부장 지정하기"
        busy={team.saving}
        error={managementError}
        onCancel={() => setHeadAssignmentDepartmentId(null)}
        onConfirm={() => {
          const member = members.find(item => item.id === headAssignmentTargetId)
          const departmentId = headAssignmentDepartmentId
          if (!member || !departmentId) return
          setHeadAssignmentDepartmentId(null)
          assign(member, departmentId, 'head')
        }}
      >
        <NativeSelect
          aria-label="새 부장"
          value={headAssignmentTargetId}
          onChange={event => setHeadAssignmentTargetId(event.target.value)}
        >
          {members.map(member => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </NativeSelect>
      </ConfirmDialog>
      <ConfirmDialog
        open={transferOpen}
        title="회장 직책을 넘길까요?"
        description="선택한 구성원에게 회장 직책을 넘겨요."
        confirmLabel="회장 넘기기"
        busy={team.saving}
        error={managementError}
        onCancel={() => setTransferOpen(false)}
        onConfirm={() => {
          void transferPresident()
        }}
      >
        <NativeSelect
          aria-label="새 회장"
          value={transferTargetId}
          onChange={event => setTransferTargetId(event.target.value)}
        >
          {members
            .filter(member => member.councilRank !== 'president')
            .map(member => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
        </NativeSelect>
      </ConfirmDialog>
      <ConfirmDialog
        open={viceRemoval !== null}
        title={`${viceRemoval?.name ?? ''}님의 부회장 직책을 해제할까요?`}
        description="부회장 직책을 해제하면 일반 구성원이 돼요."
        confirmLabel="직책 해제"
        busy={team.saving}
        error={managementError}
        onCancel={() => setViceRemoval(null)}
        onConfirm={() => {
          void changeViceRank()
        }}
      />
      <ConfirmDialog
        open={viceAssignmentOpen}
        title="부회장 직책을 지정할까요?"
        description="선택한 구성원에게 부회장 직책을 지정해요."
        confirmLabel="부회장 지정하기"
        busy={team.saving}
        error={managementError}
        onCancel={() => setViceAssignmentOpen(false)}
        onConfirm={() => {
          void assignViceRank()
        }}
      >
        <NativeSelect
          aria-label="새 부회장"
          value={viceAssignmentTargetId}
          onChange={event => setViceAssignmentTargetId(event.target.value)}
        >
          {members
            .filter(member => member.councilRank === null)
            .map(member => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
        </NativeSelect>
      </ConfirmDialog>
    </PageColumn>
  )
}

// oxlint-disable-next-line max-lines-per-function -- 조직도와 소속 없는 구성원 영역을 함께 배치한다.
function DepartmentManagementPanel({
 open,
 state,
 departments,
 saving,
}: {
 open: boolean
 state: DepartmentsState
 departments: TeamDepartment[]
 saving: boolean
}) {
 return (
   <div
     id="department-management-panel"
     aria-hidden={!open}
     className={`overflow-hidden transition-all duration-300 ease-in-out ${
       open
         ? 'max-h-screen translate-y-0 opacity-100'
         : 'pointer-events-none max-h-0 -translate-y-2 opacity-0'
     }`}
   >
     <Card className="p-4">
       <div className="mb-4 flex items-start justify-between gap-3">
         <div>
           <h3 className="text-base font-semibold text-gray-900">부서 관리</h3>
           <p className="mt-1 text-sm text-gray-500">조직의 부서 구조를 관리해요.</p>
         </div>
         <span className="text-sm text-gray-500">{departments.length}개</span>
       </div>
       {state.problemIn('list') && (
         <StateMessage kind="error">{state.problemIn('list')}</StateMessage>
       )}
       <div className="overflow-hidden rounded-md border">
         {departments.length > 0 ? (
           <ul aria-label="부서 관리" className="divide-y">
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
         ) : (
           <p className="px-4 py-6 text-sm text-gray-500">아직 부서가 없어요.</p>
         )}
       </div>
       {state.manage && (
         <div className="mt-4">
           <DepartmentCreateForm
             saving={saving}
             error={state.problemIn('create')}
             name={state.newName}
             onName={state.setNewName}
             onCreate={state.create}
             onEdit={state.clearCreateProblem}
           />
         </div>
       )}
       <DepartmentDialogs state={state} saving={saving} />
     </Card>
   </div>
 )
}

function InviteManagementPanel({
  open,
  councilId,
  onForbidden,
}: {
  open: boolean
  councilId: string
  onForbidden: () => void
}) {
  return (
    <div
      id="invite-management-panel"
      aria-hidden={!open}
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        open
          ? 'max-h-screen translate-y-0 opacity-100'
          : 'pointer-events-none max-h-0 -translate-y-2 opacity-0'
      }`}
    >
      <InviteCard councilId={councilId} onForbidden={onForbidden} />
    </div>
  )
}

// oxlint-disable-next-line max-lines-per-function -- 회장단과 부서 조직을 같은 연결선 문맥으로 배치한다.
function OrganizationChart({
  members,
  presidents,
  departments,
  titles,
  canManage,
  canTransfer,
  canRank,
  onManageMember,
  onAssignHead,
  onTransfer,
  onRemoveVice,
  onAssignVice,
}: {
  members: TeamMember[]
  presidents: TeamMember[]
  departments: TeamDepartment[]
  titles: CouncilTitles
  canManage: boolean
  canTransfer: boolean
  canRank: boolean
  onManageMember: (member: TeamMember) => void
  onAssignHead: (departmentId: string) => void
  onTransfer: () => void
  onRemoveVice: (member: TeamMember) => void
  onAssignVice: () => void
}) {
  return (
    <section aria-labelledby="organization-chart-title" className="space-y-6">
      <div className="border-b border-gray-200 pb-3">
        <h2 id="organization-chart-title" className="text-lg font-semibold text-gray-900">
          조직도
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          구성원 {members.length}명 · 부서 {departments.length}개
        </p>
      </div>
      <div className="flex flex-col items-center">
        <PresidentCard
          presidents={presidents}
          titles={titles}
          canManage={canManage}
          canTransfer={canTransfer}
          canRank={canRank}
          onManageMember={onManageMember}
          onTransfer={onTransfer}
          onRemoveVice={onRemoveVice}
          onAssignVice={onAssignVice}
        />
        {departments.length > 0 && <DepartmentConnector count={departments.length} />}
        <DepartmentGrid
          departments={departments}
          members={members}
          titles={titles}
          canManage={canManage}
          onManageMember={onManageMember}
          onAssignHead={onAssignHead}
        />
      </div>
    </section>
  )
}

// oxlint-disable-next-line max-lines-per-function -- 연결선의 SVG 경로를 한곳에서 관리한다.
function DepartmentConnector({ count }: { count: number }) {
  const visibleCount = Math.min(count, FOUR_COLUMNS)
  const positions =
    visibleCount === 1
        ? [CENTER_PERCENT]
        : Array.from(
            { length: visibleCount },
            (_, index) =>
              ((index * POSITION_STEP + 1) * PERCENT) / (visibleCount * POSITION_STEP),
          )
  return (
    <div aria-hidden className="h-16 w-full">
        <svg
          className="size-full text-gray-400"
          viewBox="0 0 100 64"
          preserveAspectRatio="none"
        >
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="48"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {positions.length > 1 && (
            <line
              x1={positions[0]}
              y1="48"
              x2={positions[positions.length - 1]}
              y2="48"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {positions.map(position => (
            <line
              key={position}
              x1={position}
              y1="48"
              x2={position}
              y2="64"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
    </div>
  )
}

// oxlint-disable-next-line max-lines-per-function -- 회장단 카드의 역할별 액션과 순서를 한 곳에서 관리한다.
function PresidentCard({
  presidents,
  titles,
  canManage,
  canTransfer,
  canRank,
  onManageMember,
  onTransfer,
  onRemoveVice,
  onAssignVice,
}: {
  presidents: TeamMember[]
  titles: CouncilTitles
  canManage: boolean
  canTransfer: boolean
  canRank: boolean
  onManageMember: (member: TeamMember) => void
  onTransfer: () => void
  onRemoveVice: (member: TeamMember) => void
  onAssignVice: () => void
}) {
  const president = presidents.find(member => member.councilRank === 'president')
  const vicePresident = presidents.find(member => member.councilRank === 'vice_president')
  const orderedPresidents = [president, vicePresident].filter(
    (member): member is TeamMember => member !== undefined,
  )
  return (
    <Card className="w-fit max-w-full rounded-md border-gray-300">
      <div className="flex items-center gap-2 rounded-t-md border-b bg-gray-50 px-4 py-3">
        <Star aria-hidden className="size-4 fill-gray-50 text-yellow-500" />
        <h3 className="text-sm font-bold text-gray-950">회장단</h3>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {president ? (
          <>
            <PersonCard
              key={president.id}
              member={president}
              titles={titles}
              emphasis
              lead
              canManage={canManage}
              onManage={() => onManageMember(president)}
              transferable={canTransfer}
              onTransfer={onTransfer}
              onRemoveVice={() => onRemoveVice(president)}
            />
            {vicePresident ? (
              <PersonCard
                key={vicePresident.id}
                member={vicePresident}
                titles={titles}
                emphasis
                lead
                canManage={canManage}
                onManage={() => onManageMember(vicePresident)}
                removableVice={canRank}
                onTransfer={onTransfer}
                onRemoveVice={() => onRemoveVice(vicePresident)}
              />
            ) : canRank ? (
              <div className="flex h-36 w-32 items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full whitespace-nowrap border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200"
                  onClick={onAssignVice}
                >
                  부회장 지정
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          orderedPresidents.length > 0 ? (
          orderedPresidents.map(member => (
            <PersonCard
              key={member.id}
              member={member}
              titles={titles}
              emphasis
              lead
              canManage={canManage}
              onManage={() => onManageMember(member)}
              transferable={canTransfer && member.councilRank === 'president'}
              removableVice={canRank && member.councilRank === 'vice_president'}
              onTransfer={onTransfer}
              onRemoveVice={() => onRemoveVice(member)}
            />
          ))
          ) : <p className="text-sm text-gray-500">회장단이 없어요.</p>
        )}
      </div>
    </Card>
  )
}

function DepartmentGrid({
  departments,
  members,
  titles,
  canManage,
  onManageMember,
  onAssignHead,
}: {
  departments: TeamDepartment[]
  members: TeamMember[]
  titles: CouncilTitles
  canManage: boolean
  onManageMember: (member: TeamMember) => void
  onAssignHead: (departmentId: string) => void
}) {
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {departments.map(department => (
        <DepartmentCard
          key={department.id}
          department={department}
          members={members}
          titles={titles}
          canManage={canManage}
          onManageMember={onManageMember}
          onAssignHead={onAssignHead}
        />
      ))}
    </div>
  )
}

function UnassignedMembersPanel({
  open,
  members,
  onManageMember,
}: {
  open: boolean
  members: TeamMember[]
  onManageMember: (member: TeamMember) => void
}) {
  return (
    <div
      id="unassigned-members-panel"
      aria-hidden={!open}
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        open
          ? 'max-h-screen translate-y-0 opacity-100'
          : 'pointer-events-none max-h-0 -translate-y-2 opacity-0'
      }`}
    >
      <Card className="p-4">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">배치되지 않은 인원</h3>
          <p className="mt-1 text-sm text-gray-500">
            부서를 정하면 조직도에 바로 표시돼요.
          </p>
        </div>
        {members.length > 0 ? (
          <ul aria-label="배치되지 않은 인원" className="divide-y rounded-md border">
            {members.map(member => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{member.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {member.profile.majorName ?? '학부 미등록'}
                    {member.profile.grade ? ` · ${member.profile.grade}학년` : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onManageMember(member)}>
                  배치하기
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">배치되지 않은 인원이 없어요.</p>
        )}
      </Card>
    </div>
  )
}

// oxlint-disable-next-line max-lines-per-function -- 카드 안에서 부장과 부원을 같은 문맥으로 계산한다.
function DepartmentCard({
  department,
  members,
  titles,
  canManage,
  onManageMember,
  onAssignHead,
}: {
  department: TeamDepartment
  members: TeamMember[]
  titles: CouncilTitles
  canManage: boolean
  onManageMember: (member: TeamMember) => void
  onAssignHead: (departmentId: string) => void
}) {
  const departmentMembers = members.filter(member =>
    member.departments.some(item => item.id === department.id),
  )
  const head = departmentMembers.find(member =>
    member.departments.some(item => item.id === department.id && item.rank === 'head'),
  )
  const viceHead = departmentMembers.find(member =>
    member.departments.some(item => item.id === department.id && item.rank === 'vice_head'),
  )
  const assigned = [head, viceHead].filter((member): member is TeamMember => member !== undefined)
  const staff = departmentMembers.filter(member => !assigned.some(item => item.id === member.id))
  return (
    <Card className="w-fit max-w-full rounded-md border-gray-300">
      <div className="rounded-t-md border-b bg-white px-4 py-3">
        <h3 className="text-sm font-bold text-gray-950">{department.name}</h3>
        <p className="mt-1 text-xs text-gray-500">
          부장 {assigned.length}명 · 부원 {staff.length}명
        </p>
      </div>
      <div className="space-y-4 p-4">
        <MemberGroup
          label="부장"
          members={assigned}
          empty={null}
          departmentId={department.id}
          departmentName={department.name}
          titles={titles}
          canManage={canManage}
          onManage={onManageMember}
          emptyContent={
            canManage ? (
              <div className="flex h-28 w-24 items-center justify-center rounded-md border border-gray-200 bg-white p-2 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full whitespace-nowrap"
                  onClick={() => onAssignHead(department.id)}
                >
                  부장 지정
                </Button>
              </div>
            ) : null
          }
        />
        <MemberGroup
          label={`부원 ${staff.length}명`}
          members={staff}
          empty="배정된 부원이 없어요."
          departmentId={department.id}
          departmentName={department.name}
          titles={titles}
          canManage={canManage}
          onManage={onManageMember}
        />
      </div>
    </Card>
  )
}

function MemberGroup({
  label,
  members,
  empty,
  departmentId,
  departmentName,
  titles,
  canManage,
  onManage,
  emptyContent,
}: {
  label: string
  members: TeamMember[]
  empty: string | null
  departmentId: string
  departmentName: string
  titles: CouncilTitles
  canManage: boolean
  onManage: (member: TeamMember) => void
  emptyContent?: ReactNode
}) {
  return (
    <div className="mx-auto w-fit max-w-full">
      <p className="mb-2 text-xs text-gray-500">{label}</p>
      <div className="grid grid-cols-2 items-start gap-2">
        {members.length > 0 ? (
          members.map(member => (
            <PersonCard
              key={member.id}
              member={member}
              titles={titles}
              departmentId={departmentId}
              departmentName={departmentName}
              canManage={canManage}
              onManage={() => onManage(member)}
            />
          ))
        ) : (
          emptyContent ?? (empty && <p className="text-sm text-gray-500">{empty}</p>)
        )}
      </div>
    </div>
  )
}

// oxlint-disable-next-line max-lines-per-function -- 상세 패널의 정보와 관련 동작을 한곳에 보여준다.
function MemberDetailsPanel({
  member,
  departments,
  titles,
  canManage,
  transferable,
  removableVice,
  onManage,
  onTransfer,
  onRemoveVice,
  onClose,
}: {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  canManage: boolean
  transferable: boolean
  removableVice: boolean
  onManage: () => void
  onTransfer: () => void
  onRemoveVice: () => void
  onClose: () => void
}) {
  const rank = member.councilRank
    ? councilRankLabel(member.councilRank, titles)
    : member.departments
        .map(item => departmentRankLabel(item.rank, titles))
        .find((value): value is string => value !== null)
  const departmentNames = member.councilRank
    ? '회장단'
    : member.departments
        .map(item => departments.find(department => department.id === item.id)?.name)
        .filter((name): name is string => name !== undefined)
        .join(', ') || '소속 없음'
  return (
    <aside
      aria-label={`${member.name} 상세 정보`}
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l bg-white shadow-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b px-6 py-5">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">구성원 정보</p>
          <h3 className="mt-1 wrap-anywhere text-xl font-semibold text-gray-900">{member.name}</h3>
        </div>
        <Button variant="ghost" size="icon" aria-label="상세 정보 닫기" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-md border bg-gray-50 p-4 text-sm">
          <dt className="text-gray-500">학교</dt>
          <dd className="wrap-anywhere text-gray-900">{member.profile.schoolName ?? '미등록'}</dd>
          <dt className="text-gray-500">단과대학</dt>
          <dd className="wrap-anywhere text-gray-900">{member.profile.collegeName ?? '미등록'}</dd>
          <dt className="text-gray-500">학부</dt>
          <dd className="wrap-anywhere text-gray-900">{member.profile.majorName ?? '미등록'}</dd>
          <dt className="text-gray-500">학년</dt>
          <dd className="text-gray-900">
            {member.profile.grade ? `${member.profile.grade}학년` : '미등록'}
          </dd>
          <dt className="text-gray-500">현재 부서</dt>
          <dd className="wrap-anywhere text-gray-900">{departmentNames}</dd>
          <dt className="text-gray-500">직책</dt>
          <dd className="text-gray-900">{rank ?? '부원'}</dd>
        </dl>
      </div>
      {(canManage || transferable || removableVice) && (
        <div className="space-y-2 border-t bg-white p-6">
          {canManage && (
            <Button variant="outline" className="w-full" onClick={onManage}>
              부서·직책 관리
            </Button>
          )}
          {transferable && (
            <Button variant="outline" className="w-full" onClick={onTransfer}>
              회장 넘기기
            </Button>
          )}
          {removableVice && (
            <Button variant="outline" className="w-full" onClick={onRemoveVice}>
              부회장 직책 해제
            </Button>
          )}
        </div>
      )}
    </aside>
  )
}

/* oxlint-disable complexity -- 카드와 상세 대화상자의 상태를 함께 관리한다. */
// oxlint-disable-next-line max-lines-per-function -- 카드와 상세 대화상자의 상태를 함께 관리한다.
function PersonCard({
  member,
  titles,
  departmentId,
  departmentName: _departmentName,
  emphasis = false,
  lead = false,
}: {
  member: TeamMember
  titles: CouncilTitles
  departmentId?: string
  departmentName?: string
  emphasis?: boolean
  lead?: boolean
  canManage?: boolean
  onManage?: () => void
  transferable?: boolean
  removableVice?: boolean
  onTransfer?: () => void
  onRemoveVice?: () => void
}) {
  const selection = useContext(MemberSelectionContext)
  const placement = departmentId
    ? member.departments.find(item => item.id === departmentId)
    : undefined
  const rank = placement
    ? departmentRankLabel(placement.rank, titles)
    : councilRankLabel(member.councilRank, titles)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => selection.onSelect(member)}
        className={`min-w-0 rounded-md border text-left ${
          emphasis
            ? member.councilRank === 'vice_president'
              ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
              : 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
            : 'border-gray-200 bg-white hover:bg-gray-50'
        } flex flex-col rounded-md ${
          lead
            ? 'h-36 w-32 p-3'
            : 'h-28 w-24 p-2 pb-4'
        }`}
      >
        {member.departments.length > 1 && (
          <Badge tone="warning" className="absolute right-2 top-2 px-1.5 py-0 text-xs">
            직책 {member.departments.length}개
          </Badge>
        )}
        <div className="flex flex-col items-start gap-2">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
              emphasis && member.councilRank === 'president'
                ? 'bg-yellow-200 text-yellow-700'
                : emphasis && member.councilRank === 'vice_president'
                  ? 'bg-blue-200 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            <UserRound aria-hidden className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col items-start">
            <div className="flex max-w-full items-center gap-1">
              <p
                className="min-w-0 truncate text-sm font-semibold text-gray-900"
                title={member.name}
              >
                {member.name}
              </p>
            </div>
            <p className="mt-1 wrap-anywhere text-xs text-gray-600">
              {member.profile.majorName ?? '미등록'}
            </p>
            <p
              className={`text-xs text-gray-400 ${
                departmentId ? 'mt-1' : ''
              }`}
            >
              {member.profile.grade ? `${member.profile.grade}학년` : '미등록'}
            </p>
            {rank && !departmentId && (
              <Badge
                tone={member.councilRank === 'president' ? 'warning' : 'info'}
                className={
                  member.councilRank === 'president'
                    ? '-ml-1 mt-1 self-start border-yellow-300 bg-yellow-300 font-semibold text-yellow-800'
                    : '-ml-1 mt-1 self-start border-blue-300 bg-blue-300 font-semibold text-blue-900'
                }
              >
                {rank}
              </Badge>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}
/* oxlint-enable complexity */
