// 회장단 홈 ③ 내가 할 일, ⑤ 이번 주, '사용 가능' 한 줄 시안(c35)의 견본 세 벌.
// 명세: notes/integration/home/c35-spec.md 1~3절. 오늘은 2026-10-29 (목).
// 바탕은 s7-data.ts의 todos·week·available이고, 명세 1절대로 ③ main에 회장단 업무(담당 부회장) 하나를 더했다.
// ③ 줄은 이미 차례대로 놓여 있다(확인할 초안 → 검토할 결과물 → 업무 지남 → 업무 오늘, 내용 파일 ③의 줄 차례).

import type { C1rPerson } from '../c1r/c1r-data'

// ③ 줄 상한(명세 1절). 넘으면 '전체 n건 보기'.
export const C35_SHOWN = 5
export const TODO_TITLE = '내가 할 일'
export const WEEK_TITLE = '이번 주'

// 홈을 보는 사람(③ 머리의 얼굴)
export const ME: C1rPerson = { name: '김바다', role: '회장' }

// ── 날짜 글 ──
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const parse = (date: string) => new Date(`${date}T00:00:00Z`)
export const dateText = (date: string) =>
  `${parse(date).getUTCMonth() + 1}월 ${parse(date).getUTCDate()}일 (${WEEK[parse(date).getUTCDay()]})`
// 날짜 칸(⑤ 안 A): 요일과 날짜 숫자
export const dayParts = (date: string) => ({
  weekday: WEEK[parse(date).getUTCDay()] ?? '',
  date: parse(date).getUTCDate(),
  month: parse(date).getUTCMonth() + 1,
})

// ── ③ 내가 할 일 ──
// 갈래: 회의록 초안 / 행사 정리 / 검토할 결과물 / 업무 지남 / 업무 오늘 마감
export type TodoKind = 'minutes' | 'event-report' | 'review' | 'late' | 'today'

export type TodoRow = {
  id: string
  kind: TodoKind
  // 가는 곳: 회의 화면 회의록 / 행사 정리 / 결과물 / 업무 패널
  source: 'meeting' | 'event' | 'output' | 'task'
  title: string
  // 사실 글(자르지 않음): '초안 준비됨 · 후속 업무 2개 제안' / '홍보부 · 10월 28일 올림' / '1일 지남' / '오늘 마감'
  fact: string
  // 위험 색을 써도 되는 줄(지남·오늘만). 그 밖에 위험 색을 쓰면 K5 불합격.
  danger: boolean
  // 오른쪽 행동 글. 업무 줄은 null(줄이 일 보기).
  action: '확인하기' | '보기' | null
  // 회장단 업무의 담당자(회장/부회장). 내 업무와 초안·결과물은 null.
  owner: C1rPerson | null
  // 행사 정리 줄의 정산 남음: 물을 사람(재정부장)
  settlement: { contact: C1rPerson; department: string } | null
}

export type TodoData = { rows: TodoRow[]; total: number }

const FINANCE = { name: '정하늘', role: '재정부장' }
const VP_LEE = { name: '이도윤', role: '부회장' }
const VP_PARK = { name: '박지우', role: '부회장' }

const MINUTES: TodoRow = {
  id: 'm-301',
  kind: 'minutes',
  source: 'meeting',
  title: '10월 4주 운영진 회의 회의록',
  fact: '초안 준비됨 · 후속 업무 2개 제안',
  danger: false,
  action: '확인하기',
  owner: null,
  settlement: null,
}

const TODO_MAIN: TodoRow[] = [
  MINUTES,
  {
    id: 'ev-5',
    kind: 'event-report',
    source: 'event',
    title: '신입생 환영회 결과보고서',
    fact: '초안 준비됨 · 정산 남음',
    danger: false,
    action: '확인하기',
    owner: null,
    settlement: { contact: FINANCE, department: '재정부' },
  },
  {
    id: 'p-401',
    kind: 'review',
    source: 'output',
    title: '가을 축제 포스터',
    fact: '홍보부 · 10월 28일 올림',
    danger: false,
    action: '보기',
    owner: null,
    settlement: null,
  },
  {
    id: 't-111',
    kind: 'late',
    source: 'task',
    title: '학생회 운영 세칙 개정안 정리',
    fact: '1일 지남',
    danger: true,
    action: null,
    owner: VP_LEE,
    settlement: null,
  },
  {
    id: 't-110',
    kind: 'today',
    source: 'task',
    title: '총학생회 대표자 회의 자료 제출',
    fact: '오늘 마감',
    danger: true,
    action: null,
    owner: null,
    settlement: null,
  },
  // 명세 1절이 더하라고 한 회장단 업무(담당 부회장). 상한 5 뒤라 전체 보기로 접힌다.
  {
    id: 't-112',
    kind: 'today',
    source: 'task',
    title: '11월 학생총회 공지문 작성',
    fact: '오늘 마감',
    danger: true,
    action: null,
    owner: VP_PARK,
    settlement: null,
  },
]

// 정상인 날: 회의록 초안 하나(제안된 후속 업무 없음)
const TODO_NORMAL: TodoRow[] = [{ ...MINUTES, fact: '초안 준비됨' }]

const todo = (rows: TodoRow[]): TodoData => ({ rows, total: rows.length })

// ── ⑤ 이번 주 ──
export type WeekItem =
  | { kind: 'meeting'; id: string; title: string; date: string; time: string; agenda: number }
  | {
      kind: 'external'
      id: string
      title: string
      date: string
      time: string | null
      label: '외부' | '제출 마감'
    }

// 날짜 차례(가까운 것 먼저). 최대 3줄.
const MEETING_MAIN: WeekItem = {
  kind: 'meeting',
  id: 'm-302',
  title: '11월 1주 운영진 회의',
  date: '2026-11-02',
  time: '19:00',
  agenda: 3,
}
const REPS: WeekItem = {
  kind: 'external',
  id: 's-1',
  title: '총학생회 대표자 회의',
  date: '2026-10-30',
  time: '18:00',
  label: '외부',
}
const WEEK_MAIN: WeekItem[] = [
  REPS,
  MEETING_MAIN,
  {
    kind: 'external',
    id: 's-2',
    title: '2학기 학생회비 집행 내역 제출',
    date: '2026-11-04',
    time: '17:00',
    label: '제출 마감',
  },
]
const WEEK_NORMAL: WeekItem[] = [REPS, { ...MEETING_MAIN, agenda: 1 }]

// ── 사용 가능 ──
// 재정 담당이 없으면 null(줄을 숨김)
const WON = new Intl.NumberFormat('ko-KR')
export const wonText = (amount: number) =>
  `${amount < 0 ? '-' : ''}${WON.format(Math.abs(amount))}원`

type C35Home = { todo: TodoData; week: WeekItem[]; available: number | null }

export const C35_DATA = {
  main: { todo: todo(TODO_MAIN), week: WEEK_MAIN, available: -120000 },
  normal: { todo: todo(TODO_NORMAL), week: WEEK_NORMAL, available: 920000 },
  empty: { todo: todo([]), week: [], available: null },
} satisfies Record<string, C35Home>
export type C35DataName = keyof typeof C35_DATA
export const C35_DATA_NAMES = Object.keys(C35_DATA) as C35DataName[]
