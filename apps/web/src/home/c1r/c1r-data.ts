// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v0~v3)은 읽기만 한다. 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
// 회장단 홈 ① '확인이 필요한 운영 상황' 컴포넌트 시안(c1r)의 공용 견본 다섯 벌.
// 명세: notes/integration/home/c1-spec.md 3절(내용 목록)·4절(상태와 견본). 오늘은 2026-10-29 (목).
// 원재료는 이전 B2(s7-data.ts의 ①)와 c1(c1-view.ts의 many·assign)을 한 파일로 모은 것이다.
// 줄은 이미 차례대로 놓여 있다(지남 오래된 것 → 오늘 → 내일 → 결재 → 부서 미정 → 미배정).
// 화면에 몇 줄을 보일지(상한 5), 어떻게 묶을지는 만드는 쪽이 정한다. 머리 건수는 total을 쓴다.

export const C1R_TODAY = '2026-10-29'
export const C1R_TODAY_TEXT = '10월 29일 (목)'
// 줄 상한(명세 6절). 넘으면 '전체 n건 보기'.
export const C1R_SHOWN = 5
// 구역 이름(명세 3절, DEC-95)
export const C1R_TITLE = '확인이 필요한 운영 상황'

export type C1rPerson = { name: string; role: string }

// 이미 물은 줄: 물은 날, 답이 있는지, 대화 내용(묻기 창 시늉에 쓴다)
export type C1rAsked = { date: string; answered: boolean; question: string; answer: string | null }

// 갈래. 차례도 이 순서다.
export type C1rKind = 'late' | 'today' | 'tomorrow' | 'approval' | 'no-department' | 'unassigned'

export type C1rRow = {
  id: string
  kind: C1rKind
  // 일 보기(제목 누르기)로 가는 곳: 업무 패널 / 요청 화면 / 운영진 > 사람
  source: 'task' | 'request' | 'members'
  // 일 제목(40자까지). 977·716은 한 줄 말줄임, 358은 2줄까지(명세 3절)
  title: string
  // 객관적 사실(10자까지, 자르지 않음): '3일 지남' / '오늘 마감' / '내일 마감' / '결재 대기 D-3' / '부서 미정' / '미배정'
  fact: string
  // 위험 색을 써도 되는 줄(지남·오늘만, 명세 6절). 그 밖의 줄에 위험 색을 쓰면 K5 불합격.
  danger: boolean
  // 연락할 사람. null이면 회장단이 직접 배정하는 줄(부서 미정·미배정)
  person: C1rPerson | null
  // 연락할 사람 글(자르지 않음): '김민준 기획부장' / '이서연 담당자' / 배정 줄은 '회장단'
  contact: string
  // 행사(선택, 30자까지, 말줄임)
  event: string | null
  // 언제의 일인지(선택): '10월 26일 (월) 마감' / '11월 1일 (일)에 필요'
  when: string | null
  // 물어본 상태(선택). askedText는 고정 꼴 '10월 28일 물어봄 · 답 있음' / '… · 답 없음'
  asked: C1rAsked | null
  askedText: string | null
  // 미배정 줄의 사람 수(그 밖은 null)
  count: number | null
}

export type C1rData = {
  // 전체 줄(차례대로). 화면에 다 보이지 않을 수 있다.
  rows: C1rRow[]
  // 전체 건수(= rows.length). 머리 건수와 '전체 n건 보기'는 이 수와 같아야 한다(K6).
  total: number
}

// ── 날짜 글 ──
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const DAY_MS = 86_400_000
const parse = (date: string) => new Date(`${date}T00:00:00Z`)
const daysBetween = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS)
const monthDay = (date: string) => `${parse(date).getUTCMonth() + 1}월 ${parse(date).getUTCDate()}일`
export const dateText = (date: string) => `${monthDay(date)} (${WEEK[parse(date).getUTCDay()]})`
const askedTextOf = (asked: C1rAsked | null) =>
  asked && `${monthDay(asked.date)} 물어봄 · ${asked.answered ? '답 있음' : '답 없음'}`

// ── 원재료 ──
type Item =
  | { kind: 'task'; id: string; title: string; dueDate: string; contact: C1rPerson; event: string | null; asked: C1rAsked | null }
  | { kind: 'approval'; id: string; title: string; neededBy: string; contact: C1rPerson; event: string | null; asked: C1rAsked | null }
  | { kind: 'no-department'; id: string; title: string; event: string | null }
  | { kind: 'unassigned-members'; count: number }

const RANK: Record<C1rKind, number> = { late: 0, today: 1, tomorrow: 2, approval: 3, 'no-department': 4, unassigned: 5 }
const PRESIDENTS = '회장단'

function rowOf(item: Item): C1rRow & { sortDate: string } {
  const base = { asked: null, askedText: null, count: null, event: null, when: null }
  switch (item.kind) {
    case 'task': {
      const late = daysBetween(item.dueDate, C1R_TODAY)
      const kind: C1rKind = late > 0 ? 'late' : late === 0 ? 'today' : 'tomorrow'
      return {
        ...base,
        id: item.id,
        kind,
        source: 'task',
        title: item.title,
        fact: kind === 'late' ? `${late}일 지남` : kind === 'today' ? '오늘 마감' : '내일 마감',
        danger: kind !== 'tomorrow',
        person: item.contact,
        contact: `${item.contact.name} ${item.contact.role}`,
        event: item.event,
        when: `${dateText(item.dueDate)} 마감`,
        asked: item.asked,
        askedText: askedTextOf(item.asked),
        sortDate: item.dueDate,
      }
    }
    case 'approval': {
      const left = daysBetween(C1R_TODAY, item.neededBy)
      return {
        ...base,
        id: item.id,
        kind: 'approval',
        source: 'request',
        title: item.title,
        fact: `결재 대기 D-${left}`,
        danger: false,
        person: item.contact,
        contact: `${item.contact.name} ${item.contact.role}`,
        event: item.event,
        when: `${dateText(item.neededBy)}에 필요`,
        asked: item.asked,
        askedText: askedTextOf(item.asked),
        sortDate: item.neededBy,
      }
    }
    case 'no-department':
      return {
        ...base,
        id: item.id,
        kind: 'no-department',
        source: 'task',
        title: item.title,
        fact: '부서 미정',
        danger: false,
        person: null,
        contact: PRESIDENTS,
        event: item.event,
        sortDate: '',
      }
    case 'unassigned-members':
      return {
        ...base,
        id: 'unassigned',
        kind: 'unassigned',
        source: 'members',
        title: `미배정 구성원 ${item.count}명`,
        fact: '미배정',
        danger: false,
        person: null,
        contact: PRESIDENTS,
        count: item.count,
        sortDate: '',
      }
  }
}

function build(items: Item[]): C1rData {
  const rows = items
    .map(rowOf)
    .toSorted((a, b) => RANK[a.kind] - RANK[b.kind] || (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0))
    .map(({ sortDate: _, ...row }) => row)
  return { rows, total: rows.length }
}

// ── 견본 ──
const KIM = { name: '김민준', role: '기획부장' }
const FINANCE = { name: '정하늘', role: '재정부장' }
const LONG_EVENT = '2026 소프트웨어융합대학 체육대회 및 학과 대항 e스포츠 리그'

// 주(main): 지남 2(하나는 물어봄 · 답 있음), 오늘 1(물어봄 · 답 없음), 내일 1, 결재 대기 1, 부서 미정 1, 미배정 1 = 7건
const MAIN: Item[] = [
  { kind: 'unassigned-members', count: 1 },
  { kind: 'approval', id: 'r-201', title: '진로 특강 다과 구매', neededBy: '2026-11-01', contact: FINANCE, event: '진로 특강', asked: null },
  { kind: 'task', id: 't-104', title: '진로 특강 현장 운영 순서표 만들기', dueDate: '2026-10-30', contact: KIM, event: '진로 특강', asked: null },
  { kind: 'no-department', id: 't-105', title: '학생회실 비품 목록 정리', event: null },
  {
    kind: 'task',
    id: 't-102',
    title: '동아리 지원금 신청서 제출',
    dueDate: '2026-10-27',
    contact: { name: '이서연', role: '담당자' },
    event: null,
    asked: {
      date: '2026-10-28',
      answered: true,
      question: '동아리 지원금 신청서 어디까지 됐어요?',
      answer: '학과 사무실 서명만 남았어요. 내일 오전에 낼게요.',
    },
  },
  {
    kind: 'task',
    id: 't-103',
    title: '부스 전기 사용 신청',
    dueDate: '2026-10-29',
    contact: { name: '박서준', role: '총무부장' },
    event: '가을 축제',
    asked: { date: '2026-10-29', answered: false, question: '부스 전기 사용 신청 오늘 마감인데 낼 수 있어요?', answer: null },
  },
  { kind: 'task', id: 't-101', title: '체험 부스 구성안 확정', dueDate: '2026-10-26', contact: KIM, event: '가을 축제', asked: null },
]

// 많음(many): 8건. 지남이 셋이라 결재·배정 줄이 상한 뒤로 간다. 긴 제목(40자 가까이)·긴 행사(말줄임) 하나 포함.
const MANY: Item[] = [
  ...MAIN,
  {
    kind: 'task',
    id: 't-106',
    title: '체육대회 및 e스포츠 리그 학과별 참가 신청서 취합해 올리기',
    dueDate: '2026-10-28',
    contact: { name: '최유나', role: '홍보부장' },
    event: LONG_EVENT,
    asked: null,
  },
]

// 배정(assign): 배정 줄 둘(부서 미정, 미배정)이 상한 안에 보인다. 4건.
const ASSIGN: Item[] = MAIN.filter(item => item.kind !== 'task' || item.dueDate === '2026-10-30')

// 첫날(empty): 업무·요청은 0건, 부서 없는 새 운영진 2명만 있다(미배정 줄 하나 = 1건).
const EMPTY: Item[] = [{ kind: 'unassigned-members', count: 2 }]

export const C1R_DATA = {
  main: build(MAIN),
  many: build(MANY),
  assign: build(ASSIGN),
  // 정상(normal): 0건
  normal: build([]),
  empty: build(EMPTY),
} satisfies Record<string, C1rData>
export type C1rDataName = keyof typeof C1R_DATA
export const C1R_DATA_NAMES = Object.keys(C1R_DATA) as C1rDataName[]
