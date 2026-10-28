import type { Action, MemberAction, TeamMember } from '@vada/contracts'
import { NOT_FOUND_RELOADED, PERMISSION_CHANGED } from '@/lib/messages'

export type Can = (action: Action) => boolean
export type Confirm = { kind: 'remove' | 'transfer'; memberId: string }
export type Confirming = { kind: Confirm['kind']; member: TeamMember }

// 줄의 동작과 그 동작이 기대는 학생회 권한. 회장·본인·직급 규칙은 서버 team/policy.ts가 줄마다 정해 member.actions로 준다(DEC-38).
// 학생회 권한(view.permissions)도 함께 보는 것은, 권한을 잃은 뒤 목록을 다시 읽기 전에도 메뉴와 대화상자를 바로 거두려는 것이다.
const NEEDS: Record<MemberAction, Action> = {
  'member.assign_department': 'member.manage',
  'member.change_rank': 'rank.manage',
  'member.hand_over_president': 'president.transfer',
  'member.remove': 'member.manage',
}
const allowed = (member: TeamMember, action: MemberAction, can: Can) =>
  member.actions.includes(action) && can(NEEDS[action])

// 줄마다 서버가 준 동작으로 보인다. 하나도 없으면 ⋯ 메뉴도 없다.
export function rowActions(member: TeamMember, can: Can) {
  return {
    assign: allowed(member, 'member.assign_department', can),
    rank: allowed(member, 'member.change_rank', can),
    transfer: allowed(member, 'member.hand_over_president', can),
    remove: allowed(member, 'member.remove', can),
  }
}

// 부서 배정 대화상자의 대상. 권한을 잃었거나 대상이 목록에서 사라지면 없다.
export function findEditing(members: TeamMember[] | undefined, editing: string | null, can: Can) {
  const target = members?.find(member => member.id === editing)
  return target && allowed(target, 'member.assign_department', can) ? target : null
}

const CONFIRM_ACTION: Record<Confirm['kind'], MemberAction> = {
  remove: 'member.remove',
  transfer: 'member.hand_over_president',
}

// 확인 대화상자의 대상. 대상이 사라졌거나 권한을 잃으면 없다.
export function findConfirming(
  members: TeamMember[] | undefined,
  confirm: Confirm | null,
  can: Can,
): Confirming | null {
  const target = confirm ? members?.find(member => member.id === confirm.memberId) : undefined
  if (!confirm || !target || !allowed(target, CONFIRM_ACTION[confirm.kind], can)) return null
  return { kind: confirm.kind, member: target }
}

// 대화상자가 닫힌 까닭: 대상이 목록에 아직 있는데 닫혔다면 권한을 잃은 것이고, 없으면 사라진 것이다.
export const closedReason = (members: TeamMember[] | undefined, id: string | null) =>
  members?.some(member => member.id === id) ? PERMISSION_CHANGED : NOT_FOUND_RELOADED
