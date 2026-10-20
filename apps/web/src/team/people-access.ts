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

// 줄마다 그 동작의 권한으로 보인다. 하나도 없으면 ⋯ 메뉴도 없다.
export function rowActions(member: TeamMember, me: string, can: Can) {
  return {
    assign: can('member.manage'),
    rank: can('rank.manage') && member.councilRank !== 'president',
    transfer: can('president.transfer') && member.id !== me,
    remove: removable(member, me, can),
  }
}

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
