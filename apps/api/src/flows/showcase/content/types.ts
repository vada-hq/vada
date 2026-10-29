import type {
  DepartmentColorKey,
  ExpenseMethod,
  IncomeSource,
  QuestionKind,
  ScheduleType,
  TaskStatus,
} from '@vada/contracts'

// 시연 학생회 내용의 모양. 내용은 content/의 다른 파일에 있고, 실행기(showcase/*.ts)가 이것을 읽어 실제 경로로 만든다.
// 때는 모두 돌리는 날(한국 날짜)에서 센 상대값이다(moment.ts). 'D-4 22:41'은 나흘 전 한국 시각 22:41, 'D+1'은 다음 날이다.
// 원본(10/30 아침의 시연 학생회)의 2026-10-30을 D0으로 옮겼다. 글 안의 날짜는 '{{D+1}}'(10월 31일 (토)), 주는 '{{D-1 주}}'(10월 5주)로 쓴다.
export type Moment = `D${string} ${string}`
export type Day = `D${string}`

// 명령 인자로 받는 실제 계정의 자리. 인자가 없으면 그 사람 이름의 가상 인물이 대신한다(회장은 꼭 있어야 한다).
export type AccountRole = 'president' | 'financeHead' | 'planningHead'

export type StaffEntry = {
  name: string
  account?: AccountRole
  vicePresident?: boolean
  department?: string
  head?: boolean
}

type DepartmentEntry = { name: string; color: DepartmentColorKey; finance?: boolean }

export type CouncilContent = {
  // 기본 이름. 명령의 --school, --council이 바꾼다.
  schoolName: string
  name: string
  // 학생회를 만드는 때(회장), 운영진이 초대 코드로 들어오기 시작하는 때, 회장이 부서를 나누는 때
  at: Moment
  joinFrom: Moment
  assignAt: Moment
  departments: DepartmentEntry[]
  staff: StaffEntry[]
}

export type EventEntry = {
  name: string
  // 만든 사람이 책임자다(DEC-79).
  by: string
  at: Moment
  startsAt: Moment | null
  endsAt: Moment | null
  place: string | null
  complete?: { by: string; at: Moment }
}

export type TaskEntry = {
  title: string
  by: string
  at: Moment
  event?: string
  department?: string
  assignee?: string
  due?: Day
  // 상태를 바꾸는 사람은 담당자(없으면 만든 사람)다.
  status?: { to: Exclude<TaskStatus, 'todo'>; at: Moment }
}

type DecisionEntry = { content: string; rationale?: string }
type AgendaEntry = { title: string; notes?: string; decisions?: DecisionEntry[] }
export type MeetingEntry = {
  title: string
  by: string
  at: Moment
  heldAt: Moment
  endsAt: Moment
  place: string
  agenda: AgendaEntry[]
  // 회의록(안건 메모와 결정)을 적는 때. 없으면 적지 않는다.
  minutesAt?: Moment
  // 회의록을 확정하는 때. 없으면 초안으로 둔다.
  confirmAt?: Moment
}

export type ScheduleEntry = {
  title: string
  type: ScheduleType
  by: string
  at: Moment
  when: { allDay: true; on: Day } | { allDay: false; startsAt: Moment; endsAt: Moment | null }
  place: string | null
}

// 예산 항목은 행사(없으면 null)와 이름으로 가리킨다. 같은 이름(식비)이 행사마다 있어서다.
export type BudgetRef = { event: string | null; purpose: string }

export type BudgetItemEntry = BudgetRef & {
  amount: number
  type: 'expense' | 'income'
  // 담당 부서. 예산 항목에 담당 부서 칸이 생기면 실행기가 보낸다(money-steps.ts budgetItemBody).
  department: string | null
}

export type FinanceContent = {
  by: string
  // 회계 기간은 돌리는 날이 든 학기다(화면의 기본값과 같다, semesterOf).
  periodAt: Moment
  account: {
    at: Moment
    name: string
    bank: string
    holder: string
    number: string
    type: 'main' | 'business'
  }
  budgetItems: (BudgetItemEntry & { at: Moment })[]
  incomes: {
    at: Moment
    source: Exclude<IncomeSource, 'participation_fee' | 'carryover'>
    amount: number
    receivedOn: Day
    budget: BudgetRef | null
    toAccount: boolean
  }[]
}

type ExpenseFields = {
  by: string
  at: Moment
  vendor: string
  description: string
  reason: string | null
  paidOn: Day
  method: ExpenseMethod
  fromAccount: boolean
  // 근거가 된 메시지(messages의 key)
  fromMessage?: string
  // 증빙 사진(영수증)을 붙이는 때. 없으면 증빙 없이 둔다(정산에 남는다).
  evidenceAt?: Moment
}

export type PurchaseEntry = {
  title: string
  event: string
  by: string
  at: Moment
  body: string | null
  neededBy?: Day
  fromMessage?: string
  items: {
    name: string
    quantity: number
    link?: string
    options?: string
    estimatedUnitPrice?: number
    estimatedShippingFee?: number
  }[]
  // 품목 이름마다 승인 금액과 예산 항목. 없으면 결재 대기로 둔다.
  decision?: {
    by: string
    at: Moment
    approve: { item: string; amount: number; budget: BudgetRef }[]
  }
  shipment?: {
    by: string
    at: Moment
    carrier: 'kr.coupangls' | 'kr.lotte'
    trackingNumber: string
  }
  // 승인한 품목을 모두 결제한 지출. 금액은 승인 금액의 합이다.
  expense?: ExpenseFields
}

export type DirectExpenseEntry = ExpenseFields & {
  amount: number
  event: string | null
  budget: BudgetRef | null
}

export type MessageEntry = {
  // 구매 요청과 지출이 근거로 가리킬 때 쓰는 이름(화면에는 보이지 않는다)
  key?: string
  // 행사만 주면 그 행사의 전체방(공지방), 부서도 주면 그 행사의 부서방이다.
  room: { event: string; department?: string }
  by: string
  at: Moment
  text: string
}

type QuestionEntry = {
  kind: QuestionKind
  title: string
  required: boolean
  choices?: string[]
}

export type ApplicantEntry = {
  name: string
  studentId: string
  // 질문 차례대로: 고르기는 선택지 이름, 짧은 답은 글, 답하지 않으면 null
  answers: (string | null)[]
  deposit?: boolean
}

export type FormEntry = {
  event: string
  by: string
  at: Moment
  name: string
  notice: string | null
  capacity: number | null
  opensAt: Moment | null
  closesAt: Moment
  fees: { payer: number; nonPayer: number } | null
  collectsPhone: boolean
  // 링크를 여는 때(DEC-93). 없으면 만든 그대로 멈춘 양식이다.
  activateAt?: Moment
  questions: QuestionEntry[]
  // 신청은 from부터 everyMinutes분마다 한 명씩 공개 경로로 한다. 휴대폰은 가짜 번호(010-0000-0001부터)다.
  applications?: { from: Moment; everyMinutes: number; list: ApplicantEntry[] }
  deposits?: { by: string; at: Moment }
}

export type FeeRosterEntry = {
  by: string
  at: Moment
  paidFrom: Day
  paidUntil: Day
  studentIds: string[]
}

export type ShowcaseContent = {
  council: CouncilContent
  events: EventEntry[]
  tasks: TaskEntry[]
  meetings: MeetingEntry[]
  schedule: ScheduleEntry[]
  finance: FinanceContent
  purchases: PurchaseEntry[]
  expenses: DirectExpenseEntry[]
  messages: MessageEntry[]
  feeRoster: FeeRosterEntry
  forms: FormEntry[]
}
