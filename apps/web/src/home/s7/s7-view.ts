import { daysBetween } from '@vada/contracts'
import { dateText } from '../s5/s5-view'
import type { S7Asked, S7AttentionItem, S7Event, S7Home, S7Person, S7Todo, S7WeekItem } from './s7-data'

// B2 시안의 글 만들기(notes/home-design-rules.md 2절, 10/29 내용 확정판). 화면 부품은 이 글을 그리기만 한다.

const SHOWN_ATTENTION = 8
const SHOWN_PER_KIND = 3
const SHOWN_WEEK = 3
const TOMORROW = 1

export const dayLabel = (date: string) => dateText(date)
const contactText = (person: S7Person) => `${person.name} (${person.role})`

// ① 줄
export type AttentionRow = {
  key: string
  // 누르면 가는 곳의 종류
  target: 'task' | 'request' | 'tasks-no-department' | 'people'
  marker: string
  title: string
  who: string
  // 연락할 사람이 회장단이 아니면 묻기(물었으면 물은 상태)
  ask: { to: S7Person; asked: S7Asked | null; attach: string } | null
  // 막힌 지 오래된 순 차례 키: 날짜가 걸린 줄은 그 날짜, 아니면 null(뒤로)
  sortDate: string | null
  rank: number
}

const RANK = { task: 0, approval: 1, 'no-department': 2, 'unassigned-members': 3 } as const

function taskMarker(dueDate: string, today: string) {
  const late = daysBetween(dueDate, today)
  if (late > 0) return `${late}일 지남`
  return late === 0 ? '오늘 마감' : '내일 마감'
}

function approvalMarker(neededBy: string, today: string) {
  const left = daysBetween(today, neededBy)
  if (left < 0) return `결재 대기 ${-left}일 지남`
  return left === 0 ? '결재 대기 오늘' : `결재 대기 D-${left}`
}

function attentionRow(item: S7AttentionItem, today: string): AttentionRow {
  switch (item.kind) {
    case 'task':
      return {
        key: item.id,
        target: 'task',
        marker: taskMarker(item.dueDate, today),
        title: item.title,
        who: contactText(item.contact),
        ask: { to: item.contact, asked: item.asked, attach: item.title },
        sortDate: item.dueDate,
        rank: RANK.task,
      }
    case 'approval':
      return {
        key: item.id,
        target: 'request',
        marker: approvalMarker(item.neededBy, today),
        title: item.title,
        who: item.contact ? contactText(item.contact) : '재정부장 없음',
        ask: item.contact ? { to: item.contact, asked: item.asked, attach: item.title } : null,
        sortDate: item.neededBy,
        rank: RANK.approval,
      }
    case 'no-department':
      return {
        key: item.id,
        target: 'tasks-no-department',
        marker: '부서 미정',
        title: item.title,
        who: '회장단',
        ask: null,
        sortDate: null,
        rank: RANK['no-department'],
      }
    case 'unassigned-members':
      return {
        key: 'unassigned-members',
        target: 'people',
        marker: '미배정',
        title: `미배정 구성원 ${item.count}명`,
        who: '회장단',
        ask: null,
        sortDate: null,
        rank: RANK['unassigned-members'],
      }
  }
}

// 막힌 지 오래된 순: 날짜가 이른 것(오래 지난 것)부터, 같은 날이면 업무 → 결재, 날짜 없는 줄은 뒤로
function byBlockedLongest(a: AttentionRow, b: AttentionRow) {
  if (a.sortDate && b.sortDate && a.sortDate !== b.sortDate) return a.sortDate < b.sortDate ? -1 : 1
  if (a.sortDate && !b.sortDate) return -1
  if (!a.sortDate && b.sortDate) return 1
  return a.rank - b.rank
}

export function attentionRows(home: S7Home) {
  const rows = home.attention.map(item => attentionRow(item, home.today)).toSorted(byBlockedLongest)
  // 머리 수는 줄과 같은 단위로 센다(업무·요청·사람 줄 모두).
  return { rows: rows.slice(0, SHOWN_ATTENTION), total: rows.length, more: rows.length > SHOWN_ATTENTION }
}

// 날짜는 요일 없이 짧게: '10월 28일 물어봄 ·'
export const askedText = (asked: S7Asked) => `${dayLabel(asked.date).replace(/ \(.\)$/, '')} 물어봄 ·`

// ② 행사
export type EventSignal = { key: string; text: string; strong: boolean; late?: boolean }

export function eventNext(card: S7Event, today: string) {
  if (!card.next) return { head: '일정 미정', date: null, strong: true }
  const left = daysBetween(today, card.next.date)
  return {
    head: `${left === 0 ? '오늘' : `D-${left}`} ${card.next.name}`,
    date: dayLabel(card.next.date),
    // 오늘·내일만 강조(객관적 사실 '임박')
    strong: left <= TOMORROW,
  }
}

const won = (amount: number) => `${amount < 0 ? '−' : ''}${Math.abs(amount).toLocaleString('ko-KR')}원`

export function eventSignals(card: S7Event): EventSignal[] {
  const signals: EventSignal[] = []
  const reg = card.registration
  if (reg) {
    const full = reg.capacity !== null && reg.count >= reg.capacity
    signals.push({
      key: 'reg',
      text: reg.capacity === null ? `신청 ${reg.count}명` : `신청 ${reg.count}/${reg.capacity}명${full ? ' 마감' : ''}`,
      strong: full,
    })
  }
  if (card.undecided.length > 0)
    signals.push({ key: 'undecided', text: card.undecided.map(what => `${what} 미정`).join(', '), strong: true })
  for (const dept of card.lateDepartments)
    signals.push({ key: `late-${dept.name}`, text: `${dept.name} 지남 ${dept.overdue}`, strong: true, late: true })
  if (card.budget)
    signals.push({
      key: 'budget',
      text: card.budget.kind === 'undecided' ? '예산 미정' : `예산 ${won(card.budget.amount)} 초과`,
      strong: true,
    })
  return signals
}

// ③ 내가 할 일
export type TodoRow = {
  key: string
  title: string
  // 둘째 줄: 강조(M+)와 조용한 글(M)
  note: string | null
  meta: string | null
  // 행사 정리의 정산 남음
  settlement: { text: string; ask: { to: S7Person; asked: S7Asked | null; attach: string } } | null
}

function todoRow(todo: S7Todo, today: string): TodoRow {
  switch (todo.kind) {
    case 'minutes':
      return {
        key: todo.id,
        title: `${todo.title} 회의록`,
        note: null,
        meta: todo.proposedTasks > 0 ? `초안 준비됨 · 후속 업무 ${todo.proposedTasks}개 제안` : '초안 준비됨',
        settlement: null,
      }
    case 'event-report':
      return {
        key: todo.id,
        title: `${todo.eventName} 결과보고서`,
        note: null,
        meta: '초안 준비됨',
        settlement: todo.settlementLeft && {
          text: `정산 남음 · ${todo.settlementLeft.department}`,
          ask: { to: todo.settlementLeft.contact, asked: todo.settlementLeft.asked, attach: todo.eventName },
        },
      }
    case 'review':
      return {
        key: todo.id,
        title: todo.title,
        note: null,
        meta: `${todo.department} · ${dayLabel(todo.uploadedOn)} 올림`,
        settlement: null,
      }
    case 'task': {
      const late = daysBetween(todo.dueDate, today)
      return {
        key: todo.id,
        title: todo.title,
        note: late > 0 ? `${late}일 지남` : '오늘 마감',
        meta: todo.owner === 'me' ? '내 업무' : contactText(todo.owner),
        settlement: null,
      }
    }
  }
}

const TODO_ORDER = { minutes: 0, 'event-report': 0, review: 1, task: 2 } as const

export function todoRows(home: S7Home): TodoRow[] {
  const groups = [0, 1, 2].map(order =>
    home.todos
      .filter(todo => TODO_ORDER[todo.kind] === order)
      .toSorted((a, b) => (a.kind === 'task' && b.kind === 'task' ? a.dueDate.localeCompare(b.dueDate) : 0))
      .slice(0, SHOWN_PER_KIND)
      .map(todo => todoRow(todo, home.today)),
  )
  const rows = groups.flat()
  // D5: 사용 가능 음수는 ③ 줄로만
  if (home.available !== null && home.available < 0)
    rows.push({ key: 'available', title: '사용 가능 금액', note: won(home.available), meta: null, settlement: null })
  return rows
}

// ⑤ 이번 주
export function weekRows(home: S7Home) {
  return home.week
    .toSorted((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))
    .slice(0, SHOWN_WEEK)
    .map((item: S7WeekItem) => ({
      item,
      date: dayLabel(item.date),
      time: item.time,
      meta: item.kind === 'meeting' ? `안건 ${item.agenda}개` : item.label,
    }))
}

// 끝 한 줄: 양수·0만(음수는 ③)
export const availableLine = (home: S7Home) =>
  home.available !== null && home.available >= 0 ? won(home.available) : null
