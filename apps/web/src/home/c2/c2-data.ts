// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(e1~e6)은 읽기만 한다. 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
// 회장단 홈 ② '행사' 구역 시안(c2)의 공용 견본 다섯 벌.
// 명세: notes/integration/home/c2-spec.md 3절(내용 목록)·4절(상태와 견본). 오늘은 2026-10-29 (목).
// 원재료 모양은 s7-data.ts의 S7Event(10/29 내용 확정판)를 그대로 쓰고, 화면 글(D-day, 신호 글)은 여기서 만든다.
// 행사는 이미 차례대로 놓여 있다(다음 일정이 가까운 순, 일정 미정은 맨 뒤). 화면에 보일 수는 상한 3(C2_SHOWN).
// 머리 수와 '전체 n개 보기'는 total을 쓴다.
import type { S7Event } from '../s7/s7-data'

export const C2_TODAY = '2026-10-29'
export const C2_TODAY_TEXT = '10월 29일 (목)'
// 행사 상한(명세 6절). 넘으면 '전체 n개 보기'.
export const C2_SHOWN = 3
// 구역 이름(명세 3절: '행사' 또는 '전체 행사 진행 현황', 짧은 쪽 권장)
export const C2_TITLE = '행사'
// 빈 상태 문구(명세 3절)
export const C2_EMPTY = '진행 중인 행사 없음'

export type C2NextName = NonNullable<S7Event['next']>['name']

// 다음 일정. text는 고정 꼴: 'D-3 신청 마감' / '오늘 행사 시작'(12자까지, 자르지 않음)
export type C2Next = {
  name: C2NextName
  date: string
  // '10월 30일 (금)'
  dateText: string
  // 오늘부터 남은 날(0 = 오늘)
  days: number
  // 'D-3' / '오늘'
  dday: string
  // 'D-3 신청 마감' = dday + ' ' + name
  text: string
}

// 움직여야 할 신호(명세 3절). 한 행사 안의 차례는 신청 → 미정 → 늦은 부서 → 예산(내용 표 차례).
// text는 고정 꼴이고 자르지 않는다. danger는 위험 색을 써도 되는 신호(지남·예산 초과만, 명세 6절).
export type C2Signal =
  | {
      kind: 'registration'
      // '18/40' / 정원 없으면 '18명' / 다 차면 '120/120 마감'
      text: string
      count: number
      capacity: number | null
      // 다 참(강조하되 위험 색은 아님)
      full: boolean
      danger: false
    }
  | {
      kind: 'undecided'
      // '장소 미정' / '시각 미정'
      text: string
      field: string
      danger: false
    }
  | {
      kind: 'late'
      // '기획부 지남 1'
      text: string
      department: string
      overdue: number
      danger: true
    }
  | {
      kind: 'budget'
      // '예산 미정' / '예산 30,000원 초과'
      text: string
      budget: 'undecided' | 'over'
      // 초과 금액(미정이면 null)
      amount: number | null
      // 초과만 true
      danger: boolean
    }

export type C2Event = {
  id: string
  // 행사 이름(30자까지). 977·716 한 줄 말줄임, 358 두 줄까지(명세 3절)
  name: string
  // 다음 일정. null이면 일정 미정
  next: C2Next | null
  // 화면에 쓰는 다음 일정 글: next.text, 없으면 '일정 미정'
  nextText: string
  // 행사가 진행 중(시작했고 아직 안 끝남). 다음 일정은 '행사 종료'다.
  ongoing: boolean
  // 신호(없으면 빈 배열 = 다음 일정 한 줄만 있는 행사)
  signals: C2Signal[]
}

export type C2Data = {
  // 전체 행사(차례대로). 화면에는 앞에서 C2_SHOWN개까지.
  events: C2Event[]
  // 전체 수(= events.length). 머리 수와 '전체 n개 보기'는 이 수와 같아야 한다(K6).
  total: number
  // 새 행사를 만들 권한(빈 상태의 [새 행사] 버튼)
  canCreate: boolean
}

// ── 날짜 글 ──
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const DAY_MS = 86_400_000
const parse = (date: string) => new Date(`${date}T00:00:00Z`)
const daysBetween = (from: string, to: string) =>
  Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS)
export const dateText = (date: string) =>
  `${parse(date).getUTCMonth() + 1}월 ${parse(date).getUTCDate()}일 (${WEEK[parse(date).getUTCDay()]})`
const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`

// ── 원재료(S7Event) → 화면 글 ──
type Raw = S7Event & { ongoing?: boolean }

function registrationOf(reg: NonNullable<Raw['registration']>): C2Signal {
  const full = reg.capacity !== null && reg.count >= reg.capacity
  const text =
    reg.capacity === null ? `${reg.count}명` : `${reg.count}/${reg.capacity}${full ? ' 마감' : ''}`
  return {
    kind: 'registration',
    text,
    count: reg.count,
    capacity: reg.capacity,
    full,
    danger: false,
  }
}

function budgetOf(budget: NonNullable<Raw['budget']>): C2Signal {
  return budget.kind === 'undecided'
    ? { kind: 'budget', text: '예산 미정', budget: 'undecided', amount: null, danger: false }
    : {
        kind: 'budget',
        text: `예산 ${won(budget.amount)} 초과`,
        budget: 'over',
        amount: budget.amount,
        danger: true,
      }
}

function signalsOf(raw: Raw): C2Signal[] {
  return [
    ...(raw.registration ? [registrationOf(raw.registration)] : []),
    ...raw.undecided.map((field): C2Signal => ({
      kind: 'undecided',
      text: `${field} 미정`,
      field,
      danger: false,
    })),
    ...raw.lateDepartments.map((late): C2Signal => ({
      kind: 'late',
      text: `${late.name} 지남 ${late.overdue}`,
      department: late.name,
      overdue: late.overdue,
      danger: true,
    })),
    ...(raw.budget ? [budgetOf(raw.budget)] : []),
  ]
}

function nextOf(next: Raw['next']): C2Next | null {
  if (!next) return null
  const days = daysBetween(C2_TODAY, next.date)
  const dday = days === 0 ? '오늘' : `D-${days}`
  return {
    name: next.name,
    date: next.date,
    dateText: dateText(next.date),
    days,
    dday,
    text: `${dday} ${next.name}`,
  }
}

function eventOf(raw: Raw): C2Event {
  const next = nextOf(raw.next)
  return {
    id: raw.id,
    name: raw.name,
    next,
    nextText: next?.text ?? '일정 미정',
    ongoing: raw.ongoing ?? false,
    signals: signalsOf(raw),
  }
}

function build(raws: Raw[], canCreate = true): C2Data {
  const events = raws
    .map(eventOf)
    // 일정 미정(next 없음)은 맨 뒤
    .sort((a, b) => (a.next?.date ?? '9999').localeCompare(b.next?.date ?? '9999'))
  return { events, total: events.length, canCreate }
}

// ── 견본 ──
// 30자 이름(명세 3절 최대 길이)
const LONG_NAME = '2026 소프트웨어융합대학 체육대회 및 학과 대항 리그'
const none = { registration: null, undecided: [], lateDepartments: [], budget: null }

const FESTIVAL: Raw = {
  ...none,
  id: 'ev-1',
  name: '가을 축제',
  ongoing: true,
  next: { name: '행사 종료', date: '2026-10-30' },
  lateDepartments: [{ name: '기획부', overdue: 1 }],
  budget: { kind: 'over', amount: 30000 },
}
const LECTURE: Raw = {
  ...none,
  id: 'ev-2',
  name: '진로 특강',
  next: { name: '신청 마감', date: '2026-10-31' },
  registration: { count: 18, capacity: 40 },
  undecided: ['장소'],
}
const SPORTS: Raw = {
  ...none,
  id: 'ev-3',
  name: LONG_NAME,
  next: { name: '신청 마감', date: '2026-11-06' },
  registration: { count: 120, capacity: 120 },
  budget: { kind: 'undecided' },
}
// 상한 뒤(전체 보기에만 있음): 학생총회(D-15 행사 시작), 겨울 MT(일정 미정)
const ASSEMBLY: Raw = {
  ...none,
  id: 'ev-4',
  name: '11월 학생총회',
  next: { name: '행사 시작', date: '2026-11-13' },
}
const WINTER: Raw = { ...none, id: 'ev-5', name: '겨울 MT', next: null }
const FESTIVAL_QUIET: Raw = {
  ...FESTIVAL,
  next: { name: '행사 종료', date: '2026-11-01' },
  lateDepartments: [],
  budget: null,
}

export const C2_DATA = {
  // 주(main): 보이는 3개, 전체 5개. 신호가 많은 날.
  //   가을 축제 · D-1 행사 종료 · 기획부 지남 1 · 예산 30,000원 초과
  //   진로 특강 · D-2 신청 마감 · 18/40 · 장소 미정
  //   체육대회(30자) · D-8 신청 마감 · 120/120 마감 · 예산 미정
  main: build([FESTIVAL, LECTURE, SPORTS, ASSEMBLY, WINTER]),
  // 평소(quiet, 설계 기준): 3개, 전체 3개. 신호는 진로 특강의 신청 현황(31/40) 하나뿐, 나머지 둘은 다음 일정 한 줄.
  //   가을 축제 · D-3 행사 종료 / 진로 특강 · D-2 신청 마감 · 31/40 / 체육대회(30자) · D-8 신청 시작
  quiet: build([
    FESTIVAL_QUIET,
    { ...LECTURE, registration: { count: 31, capacity: 40 }, undecided: [] },
    {
      ...SPORTS,
      next: { name: '신청 시작', date: '2026-11-06' },
      registration: null,
      budget: null,
    },
  ]),
  // 하나(one): 1개, 신호 없음. 가을 축제 · D-3 행사 종료
  one: build([FESTIVAL_QUIET]),
  // 빈(empty): 0개, 만들 권한 있음 → '진행 중인 행사 없음' + [새 행사]
  empty: build([], true),
  // 긴(long): main에서 체육대회(30자)에 신호 넷이 모두 붙고 다음 일정이 'D-12 신청 마감'(가장 긴 줄 폭). 전체 5개.
  //   체육대회 · D-12 신청 마감 · 120/120 마감 · 장소 미정 · 대외협력본부 지남 12 · 예산 250,000원 초과
  long: build([
    FESTIVAL,
    LECTURE,
    {
      ...SPORTS,
      next: { name: '신청 마감', date: '2026-11-10' },
      undecided: ['장소'],
      lateDepartments: [{ name: '대외협력본부', overdue: 12 }],
      budget: { kind: 'over', amount: 250000 },
    },
    ASSEMBLY,
    WINTER,
  ]),
} satisfies Record<string, C2Data>
export type C2DataName = keyof typeof C2_DATA
export const C2_DATA_NAMES = Object.keys(C2_DATA) as C2DataName[]
