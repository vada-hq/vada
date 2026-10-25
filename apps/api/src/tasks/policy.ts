import {
  TASK_ACTIONS,
  type Action,
  type ErrorCode,
  type TaskAction,
  type TaskStatus,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can, type Context } from '../access/permissions.js'

// 업무 정책(기능 015, 012의 <도메인>/policy.ts 꼴): 화면에 주는 동작(actions)과 서버의 거절이 같은 decide에서 나온다.
// 읽기는 factsOf → actionsOf, 쓰기는 업무 행을 읽은 거래에서 같은 factsOf → decide → 던짐이다.
// 규칙의 원문은 logical-model RULE-41(상태), DEC-73(지우기), DEC-28(권한)이다.

// 판정에 드는 사실. 비어 있으면 그 기준은 맞지 않는다(읽지 않은 사실은 허용이 아니라 거절이 나온다).
export type TaskFacts = {
  departmentId: string | null
  assigneeId: string | null
  // 업무를 만든 사람(판 1의 바꾼 사람). 담당자이면서 만든 사람만 지운다.
  createdBy: string | null
  // 이어진 행사의 책임자. 행사가 없거나 책임자가 없으면 null이다.
  eventOwnerId: string | null
}

type FactsRow = {
  departmentId: string | null
  assigneeId: string | null
  createdBy: string | null
  eventOwnerId: string | null
}

export const factsOf = (row: FactsRow): TaskFacts => ({
  departmentId: row.departmentId,
  assigneeId: row.assigneeId,
  createdBy: row.createdBy,
  eventOwnerId: row.eventOwnerId,
})

// 권한표가 묻는 맥락. 비어 있는 사실은 넣지 않아 그 기준이 맞지 않는다.
const contextOf = (facts: TaskFacts): Context => ({
  ...(facts.departmentId ? { departmentId: facts.departmentId } : {}),
  ...(facts.assigneeId ? { assigneeId: facts.assigneeId } : {}),
  ...(facts.createdBy ? { createdBy: facts.createdBy } : {}),
  ...(facts.eventOwnerId ? { eventOwnerId: facts.eventOwnerId } : {}),
})

// 동작 → 권한 키. 동작 이름은 권한 키와 떼어 두고(012 원칙) 서버가 여기서 짝짓는다.
const PERMISSION_OF: Record<TaskAction, Action> = {
  'task.edit': 'task.manage',
  'task.remove': 'task.delete',
  'task.change_department': 'task.set_department',
  'task.change_assignee': 'task.assign',
  'task.change_status': 'task.status',
}

// 허용이면 null, 막으면 그 쓰기가 내는 코드. 업무 동작은 상태가 막지 않아(상태는 어디로든 옮긴다, DEC-39) 권한만 본다.
export const decide = (actor: Actor, facts: TaskFacts, action: TaskAction): ErrorCode | null =>
  can(actor, PERMISSION_OF[action], contextOf(facts)) ? null : 'FORBIDDEN'

// 화면에 줄 동작: decide가 허용하는 것
export const actionsOf = (actor: Actor, facts: TaskFacts): TaskAction[] =>
  TASK_ACTIONS.filter(action => decide(actor, facts, action) === null)

// 업무를 이을 행사의 사실. 행사가 없으면 departmentIds가 null이다.
export type EventScope = {
  ownerId: string | null
  // 그 행사의 지금 담당 부서(access/event-departments.ts). 잇는 업무 자신은 아직 그 행사에 없어 세지 않는다.
  departmentIds: readonly string[] | null
}

// 행사에 새 부서의 업무 잇기(DEC-94, DEC-28 업무 표): 업무의 부서가 그 행사의 지금 담당 부서가 아니면, 잇는 순간 그 부서 사람
// 모두가 신청자 정보를 보게 된다(DEC-25, DEC-56). 그래서 그 행사의 책임자와 회장단만 한다. 행사가 없거나(떼기 포함) 부서가 없는
// 업무, 이미 담당 부서인 부서의 업무는 묻지 않는다. 만들기(decideCreate), 행사 바꾸기(event-link.ts), 선택지(create-options.ts)가 이것 하나를 쓴다.
export const decideEventLink = (
  actor: Actor,
  departmentId: string | null,
  scope: EventScope,
): ErrorCode | null => {
  if (scope.departmentIds === null || !departmentId || scope.departmentIds.includes(departmentId))
    return null
  const context = scope.ownerId ? { eventOwnerId: scope.ownerId } : {}
  return can(actor, 'task.link_event_department', context) ? null : 'FORBIDDEN'
}

type CreateInput = { departmentId: string | null; assigneeId: string | null }

// 만들기의 '본인': 담당자가 나여도 부서가 없거나 내 부서일 때만 담당자 기준을 준다(남의 부서 목록에 넣지 않는다).
// 만들기 경로(service.createTask)와 선택지 셈(create-options.ts)이 이 판정 하나를 같이 쓴다.
export const decideCreate = (
  actor: Actor,
  input: CreateInput,
  scope: EventScope,
): ErrorCode | null => {
  const mine =
    input.assigneeId === actor.memberId &&
    (!input.departmentId ||
      actor.departments.some(item => item.departmentId === input.departmentId))
  const facts = factsOf({
    createdBy: null,
    departmentId: input.departmentId,
    assigneeId: mine ? input.assigneeId : null,
    eventOwnerId: scope.ownerId,
  })
  return decide(actor, facts, 'task.edit') ?? decideEventLink(actor, input.departmentId, scope)
}

// 결과물을 이을 수 있는 업무인가(기능 015): 끝나지 않았고(취소한 업무는 읽기에서 이미 없다) 내가 그 업무의 상태를 바꿀 수 있다.
// 상세의 canMake와 만들기 경로의 확인이 같은 판정을 쓴다.
export const canLinkResult = (actor: Actor, facts: TaskFacts, status: TaskStatus) =>
  status !== 'done' && decide(actor, facts, 'task.change_status') === null
