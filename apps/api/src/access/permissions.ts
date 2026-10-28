import type { Action } from '@vada/contracts'
import type { Actor } from './actor.js'

// 권한표 하나(DEC-27, DEC-28, DEC-47). 라우트는 이 표만 묻는다(can). 칸마다 테스트가 있다(permissions.test.ts).
// 기준: 회장단은 학생회 직급이 있는 사람, 부장은 부서 직급이 있는 사람(부부장은 부장과 같다, 기준 4),
// 재정부는 재정 역할 부서의 지금 소속이다.
export type Criterion =
  | 'member'
  | 'leadership'
  | 'president'
  | 'department_head'
  | 'any_department_head'
  | 'finance'
  | 'room_member'
  | 'assignee'
  | 'assigned_creator'
  | 'requester'
  | 'event_owner'
  | 'event_department'
  | 'record_creator'
// 칸 하나: 할 수 있는 사람의 기준들. 하나라도 맞으면 된다(합치기, 기준 7). notOwnRequest는 직무 분리(기준 5)다.
export type Rule = { who: readonly Criterion[]; notOwnRequest?: boolean }
// 칸이 보는 대상. 부서 단위 칸은 departmentId, 결재 칸은 요청한 사람(requestedBy)을 받는다.
// inRoom은 대화 칸이 보는 대상이다: 요청한 사람이 그 방의 지금 참여자인가(방을 아는 라우트가 참여 줄을 읽어 넘긴다).
// assigneeId는 업무 칸이 보는 대상이다: 업무의 담당자(운영진 번호). 담당자 기준은 이것이 나일 때만 맞다.
// createdBy는 기록을 만든 사람이다. assigned_creator는 담당자와 만든 사람이 모두 나일 때, record_creator는 만든 사람이 나일 때만 맞다.
// eventOwnerId는 행사 칸이 보는 대상이다: 행사(업무가 이어진 행사 포함)의 책임자. 행사 책임자 기준은 이것이 나일 때만 맞다.
// eventDepartmentIds는 신청 칸이 보는 대상이다: 그 행사의 취소하지 않은 업무가 가리키는 부서들(eventDepartmentIdsOf). 행사 담당 부서 기준은 내 지금 소속 부서가 이 가운데 있을 때만 맞는다.
// requestedBy는 구매 요청의 요청한 사람이기도 하다: 요청한 사람 기준(requester)은 이것이 나일 때만 맞다.
export type Context = {
  departmentId?: string
  requestedBy?: string
  inRoom?: boolean
  assigneeId?: string
  createdBy?: string
  eventOwnerId?: string
  eventDepartmentIds?: readonly string[]
}

export const PERMISSIONS: { readonly [A in Action]: Rule } = {
  'council.view': { who: ['member'] },
  'council.update': { who: ['leadership'] },
  'cohort.update': { who: ['leadership'] },
  'department.manage': { who: ['leadership'] },
  'invite.manage': { who: ['leadership'] },
  'member.manage': { who: ['leadership'] },
  'rank.manage': { who: ['leadership'] },
  'president.transfer': { who: ['president'] },
  'chat.direct': { who: ['member'] },
  // 회장단도 물려받지 않는다(PRIN-5). 참여 줄이 있어야 한다.
  'chat.use': { who: ['room_member'] },
  // 업무 칸. 부장 기준은 업무의 부서(없으면 회장단만)를 맥락으로 묻는다. 담당자 기준은 회장단도 물려받지 않는다.
  // 그 행사의 업무는 책임자가 어느 부서로든 다룬다(DEC-28 '행사'의 이어진 업무 다루기).
  'task.manage': { who: ['department_head', 'assignee', 'event_owner'] },
  // 지우기: 담당자는 자기가 만든 업무만 지운다. 남이 맡긴 업무는 지우지 못한다(DEC-73).
  'task.delete': { who: ['department_head', 'assigned_creator', 'event_owner'] },
  'task.set_department': { who: ['leadership', 'event_owner'] },
  'task.assign': { who: ['department_head', 'event_owner'] },
  'task.status': { who: ['department_head', 'assignee', 'event_owner'] },
  // 행사에 새 부서의 업무 잇기(DEC-94): 그 부서 사람 모두가 그 행사의 신청자 정보를 보게 되므로(DEC-25, DEC-56)
  // 그 행사의 책임자와 회장단만 한다. 이미 담당 부서인 부서의 업무와 부서 없는 업무는 이 칸을 묻지 않는다(tasks/policy.ts).
  'task.link_event_department': { who: ['event_owner', 'leadership'] },
  // 행사 칸. 만들기는 회장단과 부서장이고 만든 사람이 책임자다(DEC-79, DEC-93). 고치기는 회장단과 그 행사의 책임자다. 책임자를 정하는 길은 없다.
  'event.create': { who: ['leadership', 'any_department_head'] },
  'event.update': { who: ['leadership', 'event_owner'] },
  // 행사 완료와 완료 취소는 회장단이다(DEC-39). 책임자도 물려받지 않는다.
  'event.complete': { who: ['leadership'] },
  // 일정의 부서가 없으면 부장 기준은 회장단만 맞는다(DEC-102).
  'schedule.create': { who: ['member'] },
  'schedule.update': { who: ['department_head', 'record_creator'] },
  'schedule.delete': { who: ['department_head', 'record_creator'] },
  // 구매 칸. 취소는 요청한 사람만이라 회장단도 물려받지 않는다. 결재에는 notOwnRequest를 두지 않는다(DEC-41, 재정부는 자기 요청도 결재한다).
  'purchase.request': { who: ['member'] },
  'purchase.cancel': { who: ['requester'] },
  'purchase.shipment': { who: ['finance', 'requester'] },
  'purchase.approve': { who: ['finance'] },
  // 이름 붙은 읽기 예외(DEC-28 '보기의 예외'). 화면은 읽기를 동작 권한으로 가리지 않고 이 이름만 본다(AGENTS.md '화면의 권한').
  // 부서 구매 보기는 직급이 있는 부서의 사람들 요청이다(home/department-purchases.ts). 직급 부서가 없으면 고를 것이 없다.
  'purchase.view_department': { who: ['any_department_head'] },
  'finance.manage': { who: ['finance'] },
  // 공개 전 결산서는 재정부만 읽는다(DEC-70). 공개 뒤에는 council.view다.
  'closing.view_draft': { who: ['finance'] },
  // 참가 신청 칸(DEC-28 '행사', DEC-25). 관리는 그 행사의 책임자와 담당 부서, 회장단(기준 3 상속)이고 신청자 정보 보기는 거기에 재정부를 더한다.
  // 납부자 명단은 재정부가 올리고, 재정부와 회장단이 본다. 재정은 직급으로 물려받지 않는다(기준 3).
  'registration.manage': { who: ['event_owner', 'event_department', 'leadership'] },
  // 입금 확인과 확인 취소는 신청 관리와 같은 기준이다(DEC-28, DEC-67). 환불함은 재정부(finance.manage)다.
  'deposit.confirm': { who: ['event_owner', 'event_department', 'leadership'] },
  'registration.view_applicants': {
    who: ['event_owner', 'event_department', 'leadership', 'finance'],
  },
  'fee_payment.manage': { who: ['finance'] },
  'fee_payment.view': { who: ['finance', 'leadership'] },
}

// 기준의 판단 하나씩. 권한표(meets)와 홈의 계층 가르기가 같은 것을 쓴다(DEC-38, 화면과 서버가 다시 적지 않는다).
export const isLeadership = (actor: Actor) => actor.councilRank !== null
// 부서 직급이 있는 부서들(부부장 포함). 소속만 있는 부서는 아니다.
export const headDepartmentIds = (actor: Actor) =>
  actor.departments.filter(item => item.rank !== null).map(item => item.departmentId)
export const isFinanceMember = (actor: Actor) =>
  actor.departments.some(item => item.role === 'finance')

function meets(actor: Actor, criterion: Criterion, context: Context) {
  switch (criterion) {
    // 상속(기준 3): 회장단은 모든 부서에서 부장 권한을 가진다.
    case 'department_head':
      return (
        isLeadership(actor) ||
        (context.departmentId !== undefined &&
          headDepartmentIds(actor).includes(context.departmentId))
      )
    case 'assigned_creator':
      return meetsContext(actor, 'assignee', context) && context.createdBy === actor.memberId
    default:
      return meetsStanding(actor, criterion, context)
  }
}

// 요청한 사람의 직급과 소속만 보는 기준. 맥락을 보는 기준은 meetsContext로 넘긴다.
function meetsStanding(actor: Actor, criterion: Criterion, context: Context) {
  switch (criterion) {
    case 'member':
      return true
    case 'leadership':
      return isLeadership(actor)
    case 'president':
      return actor.councilRank === 'president'
    // 어느 부서든 부서 직급(부부장 포함, 기준 4)이 있는 사람. 부서를 맥락으로 묻지 않는 칸(행사 만들기)이 쓴다.
    case 'any_department_head':
      return headDepartmentIds(actor).length > 0
    // 재정 권한은 직급으로 물려받지 않는다(기준 3).
    case 'finance':
      return isFinanceMember(actor)
    default:
      return meetsContext(actor, criterion, context)
  }
}

// 맥락이 가리키는 사람이나 방이 나일 때만 맞는 기준. 맥락이 없으면 모두 거부다(호출하는 쪽이 빠뜨려도 열리지 않는다).
const sameMember = (actor: Actor, memberId: string | undefined) =>
  memberId !== undefined && memberId === actor.memberId

function meetsContext(actor: Actor, criterion: Criterion, context: Context) {
  switch (criterion) {
    case 'room_member':
      return context.inRoom === true
    case 'assignee':
      return sameMember(actor, context.assigneeId)
    case 'requester':
      return sameMember(actor, context.requestedBy)
    case 'record_creator':
      return sameMember(actor, context.createdBy)
    case 'event_owner':
      return sameMember(actor, context.eventOwnerId)
    case 'event_department':
      return (
        context.eventDepartmentIds !== undefined &&
        actor.departments.some(item => context.eventDepartmentIds?.includes(item.departmentId))
      )
    default:
      return false
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
// 방에 달린 칸(room_member)은 방 없이 물을 수 없어 목록에서 뺀다.
export const permissionsOf = (actor: Actor): Action[] =>
  (Object.keys(PERMISSIONS) as Action[]).filter(
    action => !PERMISSIONS[action].who.includes('room_member') && can(actor, action),
  )
