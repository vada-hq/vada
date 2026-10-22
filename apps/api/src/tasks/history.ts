import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { TaskChange, TaskStatus, TaskVersion } from '@vada/contracts'
import { department, event, member, recordVersion } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { dueDateOf } from './due.js'

type Reader = Pick<Db, 'select'>

// 판에 담긴 하위 행의 칸 값(to_jsonb라 칸 이름이 표의 이름이다).
type Snapshot = {
  title: string
  body: string | null
  due_at: string | null
  status: TaskStatus
  department_id: string | null
  assignee_id: string | null
  event_id: string | null
}
type Names = {
  members: Map<string, string>
  departments: Map<string, string>
  events: Map<string, string>
}

const dueOf = (snapshot: Snapshot) => dueDateOf(snapshot.due_at ? new Date(snapshot.due_at) : null)

// 부서와 사람은 판에 번호만 남아 있어 지금 이름으로 보인다. 없어진 부서이거나 이름을 모르면 name이 null이다.
const refOf = (id: string | null, names: Map<string, string>) =>
  id ? { id, name: names.get(id) ?? null } : null

function changesBetween(before: Snapshot, after: Snapshot, names: Names): TaskChange[] {
  const changes: TaskChange[] = []
  if (before.title !== after.title)
    changes.push({ field: 'title', from: before.title, to: after.title })
  if (before.body !== after.body) changes.push({ field: 'body' })
  if (dueOf(before) !== dueOf(after))
    changes.push({ field: 'dueDate', from: dueOf(before), to: dueOf(after) })
  if (before.status !== after.status)
    changes.push({ field: 'status', from: before.status, to: after.status })
  if (before.department_id !== after.department_id)
    changes.push({
      field: 'department',
      from: refOf(before.department_id, names.departments),
      to: refOf(after.department_id, names.departments),
    })
  if (before.assignee_id !== after.assignee_id)
    changes.push({
      field: 'assignee',
      from: refOf(before.assignee_id, names.members),
      to: refOf(after.assignee_id, names.members),
    })
  if (before.event_id !== after.event_id)
    changes.push({
      field: 'event',
      from: refOf(before.event_id, names.events),
      to: refOf(after.event_id, names.events),
    })
  return changes
}

async function namesOf(
  db: Reader,
  ids: { members: Set<string>; departments: Set<string>; events: Set<string> },
) {
  const { members: memberIds, departments: departmentIds, events: eventIds } = ids
  const members = memberIds.size
    ? await db
        .select({ id: member.id, name: member.name })
        .from(member)
        .where(inArray(member.id, [...memberIds]))
    : []
  const departments = departmentIds.size
    ? await db
        .select({ id: department.id, name: department.name })
        .from(department)
        .where(inArray(department.id, [...departmentIds]))
    : []
  const events = eventIds.size
    ? await db
        .select({ id: event.id, name: event.name })
        .from(event)
        .where(inArray(event.id, [...eventIds]))
    : []
  return {
    events: new Map(events.map(row => [row.id, row.name])),
    members: new Map(members.map(row => [row.id, row.name])),
    departments: new Map(departments.map(row => [row.id, row.name])),
  }
}

// 업무 하나의 판 전체를 오래된 것부터. 판 1은 '만듦'이고, 그다음부터는 앞 판과 달라진 칸이다.
// 만든 사람은 판 1의 바꾼 사람이다.
export async function historyOf(db: Reader, taskId: string): Promise<TaskVersion[]> {
  const rows = await db
    .select({
      versionNo: recordVersion.versionNo,
      openedAt: sql<number>`extract(epoch from lower(${recordVersion.valid})) * 1000`.mapWith(
        Number,
      ),
      changedBy: recordVersion.changedBy,
      data: recordVersion.data,
    })
    .from(recordVersion)
    .where(eq(recordVersion.recordId, taskId))
    .orderBy(asc(recordVersion.versionNo))
  const snapshots = rows.map(row => row.data as Snapshot)
  const memberIds = new Set<string>()
  const departmentIds = new Set<string>()
  const eventIds = new Set<string>()
  for (const [index, row] of rows.entries()) {
    const snapshot = snapshots[index]!
    if (row.changedBy) memberIds.add(row.changedBy)
    if (snapshot.assignee_id) memberIds.add(snapshot.assignee_id)
    if (snapshot.department_id) departmentIds.add(snapshot.department_id)
    if (snapshot.event_id) eventIds.add(snapshot.event_id)
  }
  const names = await namesOf(db, {
    members: memberIds,
    departments: departmentIds,
    events: eventIds,
  })
  return rows.map((row, index) => {
    const previous = snapshots[index - 1]
    const by = row.changedBy
      ? { id: row.changedBy, name: names.members.get(row.changedBy) ?? '' }
      : null
    return {
      versionNo: row.versionNo,
      at: new Date(Math.round(row.openedAt)).toISOString(),
      by: by?.name ? by : null,
      changes: previous
        ? changesBetween(previous, snapshots[index]!, names)
        : [{ field: 'created' }],
    }
  })
}
