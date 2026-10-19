import type { Action } from '@vada/contracts'
import type { Actor } from './actor.js'

// 권한표 하나(DEC-27, DEC-28, DEC-47). 라우트는 이 표만 묻는다(can). 칸마다 테스트가 있다(permissions.test.ts).
// 기준: 회장단은 학생회 직급이 있는 사람, 부장은 부서 직급이 있는 사람(부부장은 부장과 같다, 기준 4),
// 재정부는 재정 역할 부서의 지금 소속이다.
export type Criterion = 'member' | 'leadership' | 'president' | 'department_head' | 'finance'
// 칸 하나: 할 수 있는 사람의 기준들. 하나라도 맞으면 된다(합치기, 기준 7). notOwnRequest는 직무 분리(기준 5)다.
export type Rule = { who: readonly Criterion[]; notOwnRequest?: boolean }
// 칸이 보는 대상. 부서 단위 칸은 departmentId, 결재 칸은 요청한 사람(requestedBy)을 받는다.
export type Context = { departmentId?: string; requestedBy?: string }

export const PERMISSIONS: { readonly [A in Action]: Rule } = {
  'council.view': { who: ['member'] },
  'council.update': { who: ['leadership'] },
  'cohort.update': { who: ['leadership'] },
  'department.manage': { who: ['leadership'] },
  'invite.manage': { who: ['leadership'] },
  'member.manage': { who: ['leadership'] },
  'rank.manage': { who: ['leadership'] },
  'president.transfer': { who: ['president'] },
}

function meets(actor: Actor, criterion: Criterion, context: Context) {
  switch (criterion) {
    case 'member':
      return true
    case 'leadership':
      return actor.councilRank !== null
    case 'president':
      return actor.councilRank === 'president'
    // 상속(기준 3): 회장단은 모든 부서에서 부장 권한을 가진다.
    case 'department_head':
      return (
        actor.councilRank !== null ||
        actor.departments.some(
          item => item.rank !== null && item.departmentId === context.departmentId,
        )
      )
    // 재정 권한은 직급으로 물려받지 않는다(기준 3).
    case 'finance':
      return actor.departments.some(item => item.role === 'finance')
  }
}

export function allows(actor: Actor, rule: Rule, context: Context = {}) {
  if (!rule.who.some(criterion => meets(actor, criterion, context))) return false
  // 직무 분리: 요청한 사람은 자기 요청을 승인하지 않는다. 재정 역할 부서도 예외가 아니다.
  // 구매 결재 칸은 notOwnRequest를 두지 않는 것으로 직무 분리를 두지 않는다(DEC-41). 재정부를 겸한 부장·회장단이 다른 칸에서 면제받지 않게 한다.
  // 요청한 사람을 모르면(requestedBy가 없으면) 자기 요청인지 가릴 수 없으므로 기본은 거부다. 호출하는 쪽이 context를 빠뜨려도 열리지 않는다.
  if (rule.notOwnRequest)
    return context.requestedBy !== undefined && context.requestedBy !== actor.memberId
  return true
}

export const can = (actor: Actor, action: Action, context?: Context) =>
  allows(actor, PERMISSIONS[action], context)

// 화면에 줄 내 권한 목록. 화면은 이 목록으로 동작 버튼을 보이거나 숨기고, 권한을 다시 계산하지 않는다(DEC-38).
export const permissionsOf = (actor: Actor): Action[] =>
  (Object.keys(PERMISSIONS) as Action[]).filter(action => can(actor, action))
