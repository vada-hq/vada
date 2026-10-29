import {
  DAY_MS,
  HOME_OPS_KINDS,
  HOME_OPS_ROW_LIMIT,
  PURCHASE_NEEDED_SOON_DAYS,
  daysBetween,
  koreanDateOf,
  type HomeOps,
  type HomeOpsKind,
  type HomeOpsRow,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { requestListOf } from '../purchases/list.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import {
  financeHeadOf,
  financeHeadlessOf,
  headlessOf,
  headOf,
  opsPeopleOf,
  personOf,
  type OpsPeople,
} from './ops-contacts.js'

type Reader = Pick<Db, 'select'>

const TOMORROW = -1

// 마감 갈래: 지난 날 수가 양수면 지남, 0이면 오늘, -1이면 내일. 그 뒤는 ①에 없다.
function dueKindOf(lateDays: number): HomeOpsKind | null {
  if (lateDays > 0) return 'late'
  if (lateDays === 0) return 'today'
  return lateDays === TOMORROW ? 'tomorrow' : null
}

// 부서 미정: 부서도 담당자도 없는 업무(대표 10/29). 업무 목록 '부서 없음 + 담당자 없음'과 같은 조건이다(떠난 담당자 포함).
const isNoDepartment = (row: OpenTask) => row.summary.department === null && row.unassigned

// 업무 줄의 연락할 사람: 부서 업무는 그 부서 부장, 부서 없는 업무는 담당자
function taskContact(people: OpsPeople, row: OpenTask) {
  const { department, assignee } = row.summary
  if (department) return headOf(people, department.id)
  return assignee ? personOf(people, assignee.id, { kind: 'assignee' }) : null
}

// 담당자가 나이거나 회장단인 업무는 ③(내가 할 일) 몫이라 ①에서 뺀다. ①은 남이 맡은 일이다.
function isCouncilWork(people: OpsPeople, actor: Actor, row: OpenTask) {
  const assignee = row.summary.assignee?.id
  return assignee !== undefined && (assignee === actor.memberId || people.council.has(assignee))
}

function taskRowsOf(open: OpenTask[], people: OpsPeople, actor: Actor, today: string) {
  const rows: HomeOpsRow[] = []
  for (const row of open) {
    const { dueDate } = row.summary
    if (isNoDepartment(row) || dueDate === null || isCouncilWork(people, actor, row)) continue
    const lateDays = daysBetween(dueDate, today)
    const kind = dueKindOf(lateDays)
    if (!kind) continue
    const contact = taskContact(people, row)
    if (contact?.memberId === actor.memberId) continue
    rows.push({
      kind,
      target: { kind: 'task', id: row.summary.id },
      title: row.summary.title,
      days: Math.abs(lateDays),
      event: row.summary.event,
      contact,
      noHead: row.summary.department ? headlessOf(people, row.summary.department.id) : null,
      actions: [],
    })
  }
  return rows
}

// 결재 대기 가운데 필요한 때가 3일 안(지난 것 포함). 재정 결재 목록과 같은 읽기·차례(필요한 때가 이른 순)다.
async function approvalRowsOf(db: Reader, actor: Actor, people: OpsPeople, now: Date) {
  const today = koreanDateOf(now)
  const until = koreanDateOf(new Date(now.getTime() + PURCHASE_NEEDED_SOON_DAYS * DAY_MS))
  const contact = financeHeadOf(people)
  if (contact?.memberId === actor.memberId) return []
  const noHead = financeHeadlessOf(people)
  const { requests } = await requestListOf(db, actor, { view: 'pending' })
  return requests
    .filter(request => request.neededBy !== null && request.neededBy <= until)
    .map((request): HomeOpsRow => ({
      kind: 'approval',
      target: { kind: 'request', id: request.id },
      title: request.title,
      days: daysBetween(today, request.neededBy!),
      event: request.event,
      contact,
      noHead,
      actions: [],
    }))
}

const KIND_ORDER = new Map(HOME_OPS_KINDS.map((kind, index) => [kind, index]))

// ① 확인이 필요한 운영 상황. 열린 업무는 이미 마감 순으로 읽어 왔다(지남은 오래된 것부터가 된다).
export async function opsOf(
  db: Reader,
  actor: Actor,
  now: Date,
  board: { open: OpenTask[]; unassignedMembers: number; financeStaffed: boolean },
): Promise<HomeOps> {
  const people = await opsPeopleOf(db, actor)
  const rows = [
    ...taskRowsOf(board.open, people, actor, koreanDateOf(now)),
    ...(await approvalRowsOf(db, actor, people, now)),
  ].sort((a, b) => KIND_ORDER.get(a.kind)! - KIND_ORDER.get(b.kind)!)
  const counts = Object.fromEntries(
    HOME_OPS_KINDS.map(kind => [kind, rows.filter(row => row.kind === kind).length]),
  ) as HomeOps['counts']
  const noDepartment = board.open.filter(isNoDepartment).length
  return {
    rows: rows.slice(0, HOME_OPS_ROW_LIMIT),
    counts,
    assign: {
      noDepartment,
      unassignedMembers: board.unassignedMembers,
      financeStaffed: board.financeStaffed,
    },
    total:
      rows.length +
      noDepartment +
      (board.unassignedMembers > 0 ? 1 : 0) +
      (board.financeStaffed ? 0 : 1),
  }
}
