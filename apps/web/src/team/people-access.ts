import type { Action, TeamMember } from '@vada/contracts'
import { NOT_FOUND_RELOADED, PERMISSION_CHANGED } from '@/lib/messages'
import { holdsRank } from './team-view'

export type Can = (action: Action) => boolean
export type Confirm = { kind: 'remove' | 'transfer'; memberId: string }
export type Confirming = { kind: Confirm['kind']; member: TeamMember }

// 내보내기: 서버와 같이 직급이 붙은 사람은 member.manage에 더해 rank.manage도 있어야 한다. 회장과 나는 내보낼 수 없다.
const removable = (member: TeamMember, me: string, can: Can) =>
  can('member.manage') &&
  member.councilRank !== 'president' &&
  member.id !== me &&
  (!holdsRank(member) || can('rank.manage'))

// 사람 상세의 동작. 각 동작의 권한으로 보인다(DEC-38). 서버와 같은 조건이다.
// place는 부서에 직급 없이 넣기와 직급 없는 소속 옮기기·빼기, rank는 부서 직급 바꾸기와 직급 붙은 소속 옮기기·빼기다.
export function personActions(member: TeamMember, me: string, can: Can) {
  return {
    place: can('member.manage'),
    rank: can('member.manage') && can('rank.manage'),
    vice: can('rank.manage') && member.councilRank !== 'president',
    transfer: can('president.transfer') && member.id !== me,
    remove: removable(member, me, can),
  }
}
export type PersonActions = ReturnType<typeof personActions>

// 그 소속을 옮기거나 뺄 수 있는가. 직급이 붙은 소속을 끝내는 것은 그 직급을 거두는 일이기도 하다.
export const canMovePlacement = (
  actions: PersonActions,
  placement: TeamMember['departments'][number],
) => actions.place && (placement.rank === null || actions.rank)

// 사람 상세의 대상. 모든 운영진이 보므로 권한과 관계없이, 목록에서 사라지면 없다.
export const findViewing = (members: TeamMember[] | undefined, viewing: string | null) =>
  members?.find(member => member.id === viewing) ?? null

// 부서 배정 대화상자의 대상. 권한을 잃었거나 대상이 목록에서 사라지면 없다.
export const findEditing = (members: TeamMember[] | undefined, editing: string | null, can: Can) =>
  can('member.manage') ? (members?.find(member => member.id === editing) ?? null) : null

// 확인 대화상자의 대상. 대상이 사라졌거나 권한을 잃으면 없다.
export function findConfirming(
  members: TeamMember[] | undefined,
  confirm: Confirm | null,
  me: string,
  can: Can,
): Confirming | null {
  const target = confirm ? members?.find(member => member.id === confirm.memberId) : undefined
  if (!confirm || !target || target.id === me) return null
  const allowed = confirm.kind === 'remove' ? removable(target, me, can) : can('president.transfer')
  return allowed ? { kind: confirm.kind, member: target } : null
}

// 대화상자가 닫힌 까닭: 대상이 목록에 아직 있는데 닫혔다면 권한을 잃은 것이고, 없으면 사라진 것이다.
export const closedReason = (members: TeamMember[] | undefined, id: string | null) =>
  members?.some(member => member.id === id) ? PERMISSION_CHANGED : NOT_FOUND_RELOADED
