import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { koreanOf, type RecordEntry } from '@vada/contracts'
import { departments, eventFinanceEvents, events, expenseReceipts, expenses, purchaseItemEvents, purchaseItems, purchaseSubmissions,
  registrationForms, registrations, tasks } from '../db/schema.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
type Line = Omit<RecordEntry, 'day' | 'at'>

// 글 도우미. 끼룩이에 보내는 글과 화면의 글이 같다.
export const kstDay = (date: Date) => koreanOf(date).slice(0, 10)
export const monthDay = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
export const won = (amount: number) => `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
const joined = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || null
const itemName = (name: string | null) => name?.trim() || '이름 없는 품목'
const names = (list: string[]) => list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} 외 ${list.length - 3}건`
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

// 완료한 행사의 준비 과정(M5c). 사람 이름은 적지 않고 부서만 적는다(끼룩이에 보내는 글과 같다).
// 완료한 행사의 기록을 바꾸는 쓰기는 모두 행사 행을 잠그고 완료를 보고 멈추므로(M5a) 여기서는 잠그지 않는다.
export async function timelineOf(db: Reader, organizationId: string, eventId: string): Promise<RecordEntry[]> {
  const [event] = await db.select({ createdAt: events.createdAt, startsAt: events.startsAt, place: events.place, completedAt: events.completedAt })
    .from(events).where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)))
  if (!event) return []
  const entries: RecordEntry[] = []
  const at = (date: Date, line: Line) => entries.push({ ...line, day: kstDay(date), at: date.toISOString() })
  const on = (day: string, line: Line) => entries.push({ ...line, day, at: null })

  at(event.createdAt, { id: 'event:created', kind: 'event', text: '행사 만듦', note: null, warning: false, tab: null })
  if (event.startsAt) at(event.startsAt, { id: 'event:day', kind: 'event', text: '행사', note: event.place, warning: false, tab: null })
  if (event.completedAt) at(event.completedAt, { id: 'event:completed', kind: 'event', text: '행사 완료', note: null, warning: false, tab: null })

  // 참가 신청: 시작(없으면 신청서를 만든 때)과 마감. 마감 줄에 취소하지 않은 신청 수를 적는다.
  const [form] = await db.select({ id: registrationForms.id, opensAt: registrationForms.opensAt, createdAt: registrationForms.createdAt,
    closesAt: registrationForms.closesAt }).from(registrationForms)
    .where(and(eq(registrationForms.organizationId, organizationId), eq(registrationForms.eventId, eventId)))
  if (form) {
    const signups = await db.select({ id: registrations.id }).from(registrations)
      .where(and(eq(registrations.formId, form.id), isNull(registrations.cancelledAt)))
    at(form.opensAt ?? form.createdAt, { id: 'registration:open', kind: 'registration', text: '참가 신청 시작', note: null, warning: false,
      tab: 'registrations' })
    at(form.closesAt, { id: 'registration:close', kind: 'registration', text: '참가 신청 마감', note: `신청 ${signups.length}명`, warning: false,
      tab: 'registrations' })
  }

  // 업무: 끝냈으면 끝낸 때(늦은 날 수), 아니면 마감일(없으면 만든 때). 마감일 당일에 끝냈으면 늦지 않다.
  const work = await db.select({ id: tasks.id, title: tasks.title, status: tasks.status, dueOn: tasks.dueOn, completedAt: tasks.completedAt,
    createdAt: tasks.createdAt, department: departments.name }).from(tasks)
    .leftJoin(departments, and(eq(departments.organizationId, tasks.organizationId), eq(departments.id, tasks.departmentId)))
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.eventId, eventId)))
  for (const task of work) {
    const due = task.dueOn ? `마감 ${monthDay(task.dueOn)}` : null
    if (task.status === 'done' && task.completedAt) {
      const late = task.dueOn ? daysBetween(task.dueOn, kstDay(task.completedAt)) : 0
      at(task.completedAt, { id: `task:${task.id}`, kind: 'task', text: `업무 완료: ${task.title}`,
        note: joined([task.department, due, late > 0 ? `${late}일 늦음` : null]), warning: late > 0, tab: 'tasks' })
    } else {
      const line: Line = { id: `task:${task.id}`, kind: 'task', text: `업무 미완료: ${task.title}`, note: joined([task.department, due]),
        warning: true, tab: 'tasks' }
      if (task.dueOn) on(task.dueOn, line)
      else at(task.createdAt, line)
    }
  }

  // 구매: 제출한 묶음, 날마다 묶은 승인·구매 완료·받음, 반려(사유)·취소는 품목마다. 작성 중 품목은 넣지 않는다.
  const submitted = await db.select({ id: purchaseSubmissions.id, at: purchaseSubmissions.submittedAt, department: departments.name,
    name: purchaseItems.productName }).from(purchaseSubmissions)
    .innerJoin(purchaseItems, and(eq(purchaseItems.organizationId, purchaseSubmissions.organizationId), eq(purchaseItems.submissionId, purchaseSubmissions.id)))
    .leftJoin(departments, and(eq(departments.organizationId, purchaseSubmissions.organizationId), eq(departments.id, purchaseSubmissions.departmentId)))
    .where(and(eq(purchaseSubmissions.organizationId, organizationId), eq(purchaseSubmissions.eventId, eventId)))
    .orderBy(asc(purchaseSubmissions.submittedAt), asc(purchaseItems.createdAt), asc(purchaseItems.id))
  const submissions = new Map<string, { at: Date; department: string | null; names: string[] }>()
  for (const row of submitted) {
    const group = submissions.get(row.id) ?? { at: row.at, department: row.department, names: [] }
    group.names.push(itemName(row.name))
    submissions.set(row.id, group)
  }
  for (const [id, group] of submissions) {
    at(group.at, { id: `submission:${id}`, kind: 'purchase', text: `구매 요청 ${group.names.length}건: ${names(group.names)}`, note: group.department,
      warning: false, tab: 'purchases' })
  }
  const items = await db.select({ id: purchaseItems.id, name: purchaseItems.productName, status: purchaseItems.status, decidedAt: purchaseItems.decidedAt,
    reason: purchaseItems.decisionReason, purchasedAt: purchaseItems.purchasedAt, receivedAt: purchaseItems.receivedAt }).from(purchaseItems)
    .where(and(eq(purchaseItems.organizationId, organizationId), eq(purchaseItems.eventId, eventId), ne(purchaseItems.status, 'draft')))
    .orderBy(asc(purchaseItems.createdAt), asc(purchaseItems.id))
  // 날마다 묶는다. 줄의 시각은 그날 가장 이른 때다.
  const daily = (prefix: string, label: string, list: { at: Date; name: string }[]) => {
    const groups = new Map<string, { at: Date; names: string[] }>()
    for (const item of [...list].sort((a, b) => a.at.getTime() - b.at.getTime())) {
      const day = kstDay(item.at)
      const group = groups.get(day) ?? { at: item.at, names: [] }
      group.names.push(item.name)
      groups.set(day, group)
    }
    for (const [day, group] of groups) {
      at(group.at, { id: `${prefix}:${day}`, kind: 'purchase', text: `${label} ${group.names.length}건: ${names(group.names)}`, note: null, warning: false,
        tab: 'purchases' })
    }
  }
  daily('approved', '구매 승인', items.filter(item => item.status === 'approved' && item.decidedAt)
    .map(item => ({ at: item.decidedAt!, name: itemName(item.name) })))
  daily('purchased', '구매 완료', items.filter(item => item.purchasedAt).map(item => ({ at: item.purchasedAt!, name: itemName(item.name) })))
  daily('received', '받음', items.filter(item => item.receivedAt).map(item => ({ at: item.receivedAt!, name: itemName(item.name) })))
  for (const item of items.filter(item => item.status === 'rejected' && item.decidedAt)) {
    at(item.decidedAt!, { id: `rejected:${item.id}`, kind: 'purchase', text: `구매 반려: ${itemName(item.name)}`, note: item.reason, warning: true,
      tab: 'purchases' })
  }
  const cancelled = items.filter(item => item.status === 'cancelled')
  if (cancelled.length) {
    // 취소한 때는 처리 기록의 마지막 취소다.
    const history = await db.select({ itemId: purchaseItemEvents.itemId, at: purchaseItemEvents.createdAt }).from(purchaseItemEvents)
      .where(and(eq(purchaseItemEvents.organizationId, organizationId), eq(purchaseItemEvents.action, 'cancelled'),
        inArray(purchaseItemEvents.itemId, cancelled.map(item => item.id)))).orderBy(asc(purchaseItemEvents.createdAt))
    const last = new Map(history.map(row => [row.itemId, row.at]))
    for (const item of cancelled) {
      const when = last.get(item.id)
      if (when) at(when, { id: `cancelled:${item.id}`, kind: 'purchase', text: `구매 취소: ${itemName(item.name)}`, note: null, warning: false,
        tab: 'purchases' })
    }
  }

  // 지출: 결제일(날짜만). 취소한 지출은 넣지 않고, 확인된 영수증이 없으면 주의다.
  const spending = await db.select({ id: expenses.id, vendor: expenses.vendor, description: expenses.description, amount: expenses.amount,
    paidOn: expenses.paidOn }).from(expenses)
    .where(and(eq(expenses.organizationId, organizationId), eq(expenses.eventId, eventId), isNull(expenses.voidedAt)))
  const ready = spending.length ? await db.select({ expenseId: expenseReceipts.expenseId }).from(expenseReceipts)
    .where(and(eq(expenseReceipts.organizationId, organizationId), inArray(expenseReceipts.expenseId, spending.map(row => row.id)),
      eq(expenseReceipts.status, 'ready'))) : []
  const receipted = new Set(ready.map(row => row.expenseId))
  for (const row of spending) {
    const missing = !receipted.has(row.id)
    on(row.paidOn, { id: `expense:${row.id}`, kind: 'expense', text: `지출 ${won(row.amount)}: ${row.vendor}`,
      note: joined([row.description, missing ? '영수증 없음' : null]), warning: missing, tab: 'finance' })
  }

  // 재정: 예산을 정한 때(전 금액), 정산, 정산 다시 엶(사유)
  const finance = await db.select({ id: eventFinanceEvents.id, action: eventFinanceEvents.action, changes: eventFinanceEvents.changes,
    reason: eventFinanceEvents.reason, createdAt: eventFinanceEvents.createdAt }).from(eventFinanceEvents)
    .where(and(eq(eventFinanceEvents.organizationId, organizationId), eq(eventFinanceEvents.eventId, eventId)))
  for (const row of finance) {
    const amount = (key: string) => typeof row.changes[key] === 'number' ? row.changes[key] as number : null
    const line: Line = row.action === 'budget_set'
      ? { id: `finance:${row.id}`, kind: 'finance', text: amount('to') === null ? '예산 미정으로 바꿈' : `예산 ${won(amount('to')!)}으로 정함`,
        note: amount('from') === null ? null : `전에는 ${won(amount('from')!)}`, warning: false, tab: 'finance' }
      : row.action === 'settled'
        ? { id: `finance:${row.id}`, kind: 'finance', text: '정산', note: amount('spent') === null ? null : `집행 ${won(amount('spent')!)}`, warning: false,
          tab: 'finance' }
        : { id: `finance:${row.id}`, kind: 'finance', text: '정산 다시 엶', note: row.reason, warning: false, tab: 'finance' }
    at(row.createdAt, line)
  }

  return entries.sort((a, b) => a.day.localeCompare(b.day) || (a.at ?? '').localeCompare(b.at ?? '') || a.id.localeCompare(b.id))
}
