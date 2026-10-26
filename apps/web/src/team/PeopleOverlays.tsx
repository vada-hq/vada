import type { CouncilView } from '@vada/contracts'
import { UndoToast } from '@/components/UndoToast'
import MemberDepartmentsDialog from './MemberDepartmentsDialog'
import { personActions } from './people-access'
import { PeopleConfirmDialogs } from './PeopleConfirmDialogs'
import { PersonSheet } from './PersonSheet'
import type { PeopleState } from './usePeople'
import type { Team } from './useTeam'

type Props = { people: PeopleState; view: CouncilView; team: Team }

// 조직 화면의 사람 쪽 창들: 사람 상세, 부서 배정, 확인 창(회장 넘기기·내보내기), 되돌리기 토스트.
// 토스트는 상세가 열려 있으면 상세 안에, 닫혀 있으면 화면 아래에 둔다(한 번에 하나).
export function PeopleOverlays({ people, view, team }: Props) {
  const member = people.viewingMember
  return (
    <>
      {member && team.data && (
        <PersonSheet
          key={member.id}
          member={member}
          departments={team.data.departments}
          titles={view.council.titles}
          actions={personActions(member, people.me, people.can)}
          saving={team.saving}
          error={people.confirming ? '' : people.message}
          toast={<Toast people={people} saving={team.saving} />}
          onSave={item => people.save(member, item)}
          onConfirm={kind => people.askConfirm(kind, member)}
          onClose={people.closePerson}
        />
      )}
      {!member && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <Toast people={people} saving={team.saving} className="pointer-events-auto max-w-120" />
        </div>
      )}
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
    </>
  )
}

function Toast({
  people,
  saving,
  className,
}: {
  people: PeopleState
  saving: boolean
  className?: string
}) {
  const shown = people.undo.shown
  if (!shown) return null
  return (
    <UndoToast
      key={shown.at}
      text={shown.text}
      error={shown.error}
      busy={saving}
      className={className}
      onUndo={() => {
        void people.undo.undo()
      }}
      onDismiss={people.undo.dismiss}
    />
  )
}

function AssignDialog({ people, view, team }: Props) {
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
