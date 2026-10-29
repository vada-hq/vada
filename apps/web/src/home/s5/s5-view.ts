import { daysBetween, dayTime, monthDay } from '@vada/contracts'
import type { S5BoardEvent, S5FollowUp, S5Home, S5SettlementKind, S5Upcoming } from './s5-data'

// S5 시안의 글 만들기(notes/home-design-rules.md 2절). 화면 부품은 이 글을 그리기만 한다.

const SHOWN_ROWS = 3
const STALE_DAYS = 3
const ENDED_LONG_DAYS = 7

export const dateText = (date: string) => `${monthDay(date)} (${dayTime(`${date}T`).weekday})`
const dateOf = (iso: string) => iso.slice(0, 10)

export type AttentionRow = {
  key: string
  // 업무·요청·사람: 누르면 가는 곳의 종류
  target: { kind: 'task' | 'request' | 'people' | 'purchases'; id?: string }
  marker: string
  title: string
  who: string
  event: string | null
}

function taskRow(today: string, item: S5Home['board']['attention']['items'][number]): AttentionRow {
  const { task, reason } = item
  const dept = task.department?.name
  const due = task.dueDate
  if (reason === 'overdue') {
    const who = task.assignee
      ? `${task.assignee.name}${dept ? ` (${dept})` : ''}`
      : (dept ?? '학생회 업무')
    return {
      key: task.id,
      target: { kind: 'task', id: task.id },
      marker: `${due ? daysBetween(due, today) : 0}일 지남`,
      title: task.title,
      who,
      event: task.event?.name ?? null,
    }
  }
  return {
    key: task.id,
    target: { kind: 'task', id: task.id },
    marker: due ? `담당자 없음 D-${daysBetween(today, due)}` : '담당자 없음',
    title: task.title,
    who: dept ?? '학생회 업무',
    event: task.event?.name ?? null,
  }
}

// ① 줄: 업무(서버 차례) 3줄 → 오래된 결재 1줄 → 미배정 구성원 1줄
export function attentionRows(home: S5Home): AttentionRow[] {
  const { board, today } = home
  const rows = board.attention.items.slice(0, SHOWN_ROWS).map(item => taskRow(today, item))
  const stale = board.stalePending.requests.filter(
    request => daysBetween(dateOf(request.createdAt), today) > STALE_DAYS,
  )
  const oldest = stale[0]
  if (oldest)
    rows.push({
      key: oldest.id,
      target: stale.length === 1 ? { kind: 'request', id: oldest.id } : { kind: 'purchases' },
      marker: `결재 ${daysBetween(dateOf(oldest.createdAt), today)}일 대기`,
      title: stale.length === 1 ? oldest.title : `오래된 결재 대기 ${stale.length}건`,
      who: board.financeStaffed ? (board.financeDepartment?.name ?? '재정 부서') : '재정 부서 없음',
      event: oldest.event?.name ?? null,
    })
  if (board.unassignedMembers > 0)
    rows.push({
      key: 'unassigned-members',
      target: { kind: 'people' },
      marker: '미배정',
      title: `미배정 구성원 ${board.unassignedMembers}명`,
      who: '회장단',
      event: null,
    })
  return rows
}

export const attentionMore = (home: S5Home) =>
  home.board.attention.total > SHOWN_ROWS ? home.board.attention.total : null

// ② 행사
export const eventStatus = (card: S5BoardEvent) =>
  card.event.status === 'ongoing' ? '진행 중' : '기획 중'

export function eventWhen(card: S5BoardEvent, today: string) {
  const { status, startsAt, endsAt } = card.event
  if (status === 'ongoing' && endsAt) return { date: `${dateText(dateOf(endsAt))}까지`, d: null }
  if (!startsAt) return { date: '미정', d: null }
  const start = dateOf(startsAt)
  return { date: dateText(start), d: `D-${daysBetween(today, start)}` }
}

export function eventRisks(card: S5BoardEvent) {
  const risks: { label: string; query: string }[] = []
  if (card.tasks.overdue > 0) risks.push({ label: `지남 ${card.tasks.overdue}`, query: 'overdue' })
  if (card.tasks.unassigned > 0)
    risks.push({ label: `담당자 없음 ${card.tasks.unassigned}`, query: 'unassigned' })
  return risks
}

export function eventNext(card: S5BoardEvent) {
  if (!card.next) return null
  if (card.next.kind === 'task') return `${dateText(card.next.dueDate)} ${card.next.title}`
  return `${dateText(dateOf(card.next.startsAt))} 행사 시작`
}

export const eventsTotal = (home: S5Home) => {
  const { planning, ongoing, followUp } = home.board.events.counts
  return planning + ongoing + followUp
}

// ③ 마무리할 일
export type ListRow = {
  key: string
  title: string
  meta: string | null
  note: string | null
}

const endedText = (item: S5FollowUp, fromDays: number) =>
  item.endedDays >= fromDays
    ? `끝난 지 ${item.endedDays}일`
    : `${dateText(dateOf(item.event.endsAt))} 종료`

const isDone = (item: S5FollowUp) => item.remaining.tasks === 0 && item.remaining.settlement === 0

export function finishRows(home: S5Home, shownTaskIds: Set<string>): ListRow[] {
  const done = home.board.followUp.events.filter(isDone).slice(0, SHOWN_ROWS)
  const rows: ListRow[] = done.map(item => ({
    key: item.event.id,
    title: item.event.name,
    meta: endedText(item, ENDED_LONG_DAYS),
    note: '완료 가능',
  }))
  for (const meeting of home.board.draftMinutes.meetings.slice(0, SHOWN_ROWS)) {
    const where = meeting.event?.name ?? meeting.hostDepartment?.name
    rows.push({
      key: meeting.id,
      title: meeting.title,
      meta: `${dateText(dateOf(meeting.heldAt))}${where ? ` · ${where}` : ''}`,
      note: '확정 전',
    })
  }
  const { myTasks } = home
  if (myTasks.open > 0) {
    const nearest =
      myTasks.nearest && !shownTaskIds.has(myTasks.nearest.id)
        ? `다음 마감 ${dateText(myTasks.nearest.dueDate)}`
        : null
    rows.push({
      key: 'my-tasks',
      title: `내 업무 ${myTasks.open}`,
      meta: nearest,
      note: myTasks.overdue > 0 ? `지남 ${myTasks.overdue}` : null,
    })
  }
  return rows
}

// ④ 정산과 기록
const KIND_NAMES: Record<S5SettlementKind, string> = {
  no_evidence: '증빙 없음',
  unreimbursed: '환급 안 됨',
  no_reason: '사유 없음',
  refund_pending: '환불 대기',
  unpaid_items: '결제 전 품목',
  pending_items: '결재 전 품목',
}
const won = (amount: number) =>
  `${amount < 0 ? '−' : ''}${Math.abs(amount).toLocaleString('ko-KR')}원`

export function financeRows(home: S5Home): ListRow[] {
  const rows: ListRow[] = home.board.followUp.events
    .filter(item => !isDone(item))
    .map(item => ({
      key: item.event.id,
      title: item.event.name,
      meta: endedText(item, ENDED_LONG_DAYS),
      note: [
        ...item.remaining.settlementKinds
          .filter(kind => kind.count > 0)
          .map(kind => `${KIND_NAMES[kind.kind]} ${kind.count}`),
        ...(item.remaining.tasks > 0 ? [`업무 ${item.remaining.tasks}`] : []),
      ].join(', '),
    }))
  const { missing, noEvidenceOutsideEvents, overview } = home.financeSummary
  const first = missing[0]
  if (first)
    rows.push({
      key: `missing-${first.id}`,
      title:
        missing.length === 1
          ? `${first.name} 예산 미입력`
          : `${first.name} 외 ${missing.length - 1}개 예산 미입력`,
      meta: null,
      note: null,
    })
  if (noEvidenceOutsideEvents > 0)
    rows.push({
      key: 'no-evidence',
      title: `증빙 없는 지출 ${noEvidenceOutsideEvents}건`,
      meta: null,
      note: null,
    })
  if (overview && overview.available < 0)
    rows.push({ key: 'available', title: '사용 가능', meta: null, note: won(overview.available) })
  return rows
}

// ⑤ 가까운 주요 일정
const SCHEDULE_NAMES = { deadline: '마감', academic: '학사', external: '외부', other: '기타' }

export function upcomingRow(item: S5Upcoming) {
  const when = { date: dateText(item.date), time: item.time }
  switch (item.kind) {
    case 'event_start':
      return { key: `start-${item.event.id}`, when, title: item.event.name, kind: '행사 시작' }
    case 'registration_close':
      return {
        key: `form-${item.form.id}`,
        when,
        title: item.form.name,
        kind: `신청 마감 · ${item.event.name}`,
      }
    case 'task_due':
      return {
        key: item.task.id,
        when,
        title: item.task.title,
        kind: item.task.event ? `업무 마감 · ${item.task.event.name}` : '업무 마감',
      }
    case 'schedule_item':
      return {
        key: item.item.id,
        when,
        title: item.item.title,
        kind: SCHEDULE_NAMES[item.item.type],
      }
  }
}

export const upcomingRows = (home: S5Home) =>
  home.upcoming.items.slice(0, SHOWN_ROWS).map(upcomingRow)
export const upcomingShown = SHOWN_ROWS
