import { daysBetween } from '@vada/contracts'
import { dateText } from '../s5/s5-view'
import { S7_DATA } from '../s7/s7-data'
import type { S7Asked, S7AttentionItem, S7Person } from '../s7/s7-data'

// ① '확인이 필요한 운영 상황' 컴포넌트 시안(C1, 10/29). 견본은 B2(s7)의 ①을 그대로 쓰고, 상한을 보이려 8건짜리를 더한다.
// 원천: notes/integration/home/president-home-content.md '① 확인이 필요한 운영 상황'.

export const SHOWN = 5

// 갈래: 차례도 이 순서다(지남 → 오늘 → 내일 → 결재 → 부서 미정 → 미배정).
export type C1Kind = 'late' | 'today' | 'tomorrow' | 'approval' | 'no-department' | 'unassigned'
const RANK: Record<C1Kind, number> = { late: 0, today: 1, tomorrow: 2, approval: 3, 'no-department': 4, unassigned: 5 }

// B안의 묶음
export type C1Group = 'late' | 'soon' | 'approval' | 'assign'
export const GROUP_OF: Record<C1Kind, C1Group> = {
  late: 'late',
  today: 'soon',
  tomorrow: 'soon',
  approval: 'approval',
  'no-department': 'assign',
  unassigned: 'assign',
}
export const GROUP_LABEL: Record<C1Group, string> = {
  late: '지남',
  soon: '오늘·내일 마감',
  approval: '결재 대기',
  assign: '배정할 것',
}

export type C1Row = {
  key: string
  kind: C1Kind
  title: string
  // 객관적 사실. danger는 위험 색(지남·오늘), strong은 진한 글자(내일, D-n, 미정)
  fact: string
  // B안 묶음 안에서 쓰는 짧은 사실(묶음 머리가 이미 갈래를 말한다)
  shortFact: string
  tone: 'danger' | 'strong'
  // 언제의 일인지(마감·필요한 때)
  when: string | null
  // 연락할 사람(없으면 회장단이 배정하는 줄)
  person: S7Person | null
  asked: S7Asked | null
  sortDate: string
}

function taskRow(item: Extract<S7AttentionItem, { kind: 'task' }>, today: string): C1Row {
  const late = daysBetween(item.dueDate, today)
  const kind: C1Kind = late > 0 ? 'late' : late === 0 ? 'today' : 'tomorrow'
  const fact = kind === 'late' ? `${late}일 지남` : kind === 'today' ? '오늘 마감' : '내일 마감'
  return {
    key: item.id,
    kind,
    title: item.title,
    fact,
    shortFact: kind === 'late' ? `${late}일` : kind === 'today' ? '오늘' : '내일',
    tone: kind === 'tomorrow' ? 'strong' : 'danger',
    when: `${dateText(item.dueDate)} 마감`,
    person: item.contact,
    asked: item.asked,
    sortDate: item.dueDate,
  }
}

function row(item: S7AttentionItem, today: string): C1Row {
  switch (item.kind) {
    case 'task':
      return taskRow(item, today)
    case 'approval': {
      const left = daysBetween(today, item.neededBy)
      const short = left <= 0 ? '오늘' : `D-${left}`
      return {
        key: item.id,
        kind: 'approval',
        title: item.title,
        fact: `결재 대기 ${short}`,
        shortFact: short,
        tone: left <= 0 ? 'danger' : 'strong',
        when: `${dateText(item.neededBy)}에 필요`,
        person: item.contact,
        asked: item.asked,
        sortDate: item.neededBy,
      }
    }
    case 'no-department':
      return { key: item.id, kind: 'no-department', title: item.title, fact: '부서 미정', shortFact: '부서 미정', tone: 'strong', when: null, person: null, asked: null, sortDate: '' }
    case 'unassigned-members':
      return {
        key: 'unassigned',
        kind: 'unassigned',
        title: `미배정 구성원 ${item.count}명`,
        fact: '미배정',
        shortFact: '부서 없음',
        tone: 'strong',
        when: null,
        person: null,
        asked: null,
        sortDate: '',
      }
  }
}

const byKindThenOldest = (a: C1Row, b: C1Row) =>
  RANK[a.kind] - RANK[b.kind] || (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0)

export function c1Rows(items: S7AttentionItem[], today: string) {
  const rows = items.map(item => row(item, today)).toSorted(byKindThenOldest)
  return { rows: rows.slice(0, SHOWN), total: rows.length, more: rows.length > SHOWN }
}

// B안: 보이는 줄(상한 안)을 갈래로 묶는다. 머리 수는 그 갈래의 전체 수다.
export function c1Groups(items: S7AttentionItem[], today: string) {
  const all = items.map(item => row(item, today)).toSorted(byKindThenOldest)
  const shown = all.slice(0, SHOWN)
  const groups: { group: C1Group; total: number; rows: C1Row[] }[] = []
  for (const r of shown) {
    const group = GROUP_OF[r.kind]
    const last = groups.at(-1)
    if (last?.group === group) last.rows.push(r)
    else groups.push({ group, total: all.filter(x => GROUP_OF[x.kind] === group).length, rows: [r] })
  }
  return { groups, total: all.length, more: all.length > SHOWN }
}

export const askedDate = (asked: S7Asked) => dateText(asked.date).replace(/ \(.\)$/, '')
export const initialOf = (person: S7Person) => person.name.slice(0, 1)

const main = S7_DATA.main.attention
// 상한(5)을 넘는 8건: 지남이 넷이라 결재·배정 줄이 '전체 보기' 뒤로 간다.
const many: S7AttentionItem[] = [
  ...main,
  { kind: 'task', id: 't-106', title: '가을 축제 사진 정리해 올리기', dueDate: '2026-10-28', contact: { name: '최유나', role: '홍보부장' }, asked: null },
]
// 배정 줄 모양 확인용: main에서는 상한 뒤라 보이지 않는다.
const assign: S7AttentionItem[] = main.filter(item => item.kind !== 'task' || item.dueDate === '2026-10-30')
export const C1_DATA = { main, many, assign, normal: [] as S7AttentionItem[] }
export type C1DataName = keyof typeof C1_DATA
export const C1_TODAY = S7_DATA.main.today
