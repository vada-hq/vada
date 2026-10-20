import type { CouncilView } from '@vada/contracts'
import type { Reading } from '@/lib/use-lost'
import { useReveal } from '@/lib/use-reveal'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import InviteCard from './InviteCard'
import { MemberRow } from './MemberRow'
import MemberDepartmentsDialog from './MemberDepartmentsDialog'
import { rowActions } from './people-access'
import { PeopleConfirmDialogs } from './PeopleConfirmDialogs'
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

// 운영진 > 사람: 이름, 직급(학생회가 정한 표시 이름), 부서와 부서 직급, 들어온 날. 들어온 순서대로다(DEC-47).
// 회장단은 초대 링크와 줄마다 ⋯ 메뉴(부서 배정, 직급, 내보내기)를 보고, 회장은 회장 넘기기를 더 본다.
// 동작 버튼은 서버가 준 내 권한 목록으로만 보이거나 숨긴다(DEC-38). 대화상자는 대상이 목록에 있고 권한이 있을 때만 열려 있다.
export default function People({ view, reading, team, onCouncilChanged, onOwnChange }: Props) {
  const people = usePeople({ view, reading }, team, onOwnChange)
  if (!team.data) return <LoadState failed={team.loadFailed} onRetry={team.reload} />
  const { members, departments } = team.data
  const titles = view.council.titles
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {people.can('invite.manage') && (
        <InviteCard councilId={view.council.id} onForbidden={onCouncilChanged} />
      )}
      <h2 className="text-base font-semibold text-gray-900">운영진 {members.length}명</h2>
      {people.pageMessage && <PageMessage text={people.pageMessage} />}
      <Card className="overflow-hidden">
        <ul aria-label="운영진" className="divide-y">
          {members.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              departments={departments}
              titles={titles}
              actions={rowActions(member, people.me, people.can)}
              saving={team.saving}
              triggerRef={people.menuFocus.triggerRef(member.id)}
              onAssign={() => people.openAssign(member)}
              onToggleRank={() => people.toggleViceRank(member)}
              onTransfer={() => people.askConfirm('transfer', member)}
              onRemove={() => people.askConfirm('remove', member)}
            />
          ))}
        </ul>
      </Card>
      <AssignDialog people={people} view={view} team={team} />
      <PeopleConfirmDialogs
        confirming={people.confirming}
        titles={titles}
        saving={team.saving}
        error={people.message}
        onCloseAutoFocus={people.menuFocus.onCloseAutoFocus}
        onCancel={people.cancelConfirm}
        onConfirm={() => {
          void people.confirmed()
        }}
      />
    </div>
  )
}

type AssignProps = { people: PeopleState; view: CouncilView; team: Team }

function AssignDialog({ people, view, team }: AssignProps) {
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

function LoadState({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (!failed) return <StateMessage kind="loading">운영진 불러오는 중…</StateMessage>
  return (
    <Card className="flex flex-col gap-3 p-6">
      <StateMessage kind="error">운영진을 불러오지 못했어요.</StateMessage>
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
