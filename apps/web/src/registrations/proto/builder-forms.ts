// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다. 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
// 양식 만들기 화면 시안의 서버 모양 견본: 행사(EventDetail), 계좌(AccountItem), 양식(RegistrationForm).
// v0는 이것을 지금 부품에 그대로 넣는다. 화면 글로 바꾼 것은 builder-data.ts에 있다.
// 판 문서: notes/integration/events/form-builder-board.md
import type {
  AccountItem,
  EventDetail,
  FormAction,
  FormActivationCondition,
  RegistrationForm,
} from '@vada/contracts'
import { MAIN_QUESTIONS } from '@/public/proto/form-questions'

export const COUNCIL_NAME = '컴퓨터공학과'
// 오늘(한국 날짜). 앞 회차 견본(10/29) 다음 날
export const TODAY = '2026-10-30'
// 배포 사이트 주소. v0는 지금 구현대로 창 주소(127.0.0.1:5292)를 쓴다.
export const PUBLIC_ORIGIN = 'https://vada-m1.onrender.com'

export const EVENT: EventDetail = {
  id: '0199d1a0-0000-7000-8000-00000000e001',
  name: '2026 새내기 배움터',
  startsAt: '2027-02-23T10:00',
  endsAt: '2027-02-25T12:00',
  place: '가평 베이직하우스',
  owner: { id: '0199d1a0-0000-7000-8000-00000000a001', name: '김바다', current: true },
  status: 'upcoming',
  tasks: { open: 6, total: 9 },
  departments: ['기획부', '재정부'],
  health: { overdue: 0, unassigned: 0 },
  next: { kind: 'start', startsAt: '2027-02-23T10:00' },
  endedDays: null,
  history: [],
  approvals: [],
  actions: ['event.update'],
  blockers: {},
}

type AccountParts = Pick<AccountItem, 'name' | 'bank' | 'accountNumber' | 'type'>
const account = (n: string, parts: AccountParts): AccountItem => ({
  id: `0199d1a0-0000-7000-8000-00000000c${n}`,
  ...parts,
  holder: '컴퓨터공학과 학생회',
  closedOn: null,
  formsInUse: 0,
  actions: [],
})

// 닫지 않은 계좌 둘. 대표 계좌(카카오뱅크)를 먼저 고른다(pickAccount, DEC-45).
export const ACCOUNTS: AccountItem[] = [
  account('001', {
    name: '학생회 대표 계좌',
    bank: '카카오뱅크',
    accountNumber: '3333-01-2345678',
    type: 'main',
  }),
  account('002', {
    name: '행사 전용 계좌',
    bank: '토스뱅크',
    accountNumber: '1000-2345-6789',
    type: 'business',
  }),
]
export const MAIN_ACCOUNT = ACCOUNTS[0]!

// 상태마다 서버가 주는 동작(apps/api/src/registrations/policy.ts actionsOf와 같은 규칙, 권한은 다 있다고 본다).
const PAUSED_ACTIONS: FormAction[] = [
  'form.update',
  'form.resume',
  'form.activate',
  'form.check_in',
  'form.view_applicants',
]
const OPEN_ACTIONS: FormAction[] = [
  'form.update',
  'form.pause',
  'form.check_in',
  'form.view_applicants',
]
const CLOSED_ACTIONS: FormAction[] = ['form.update', 'form.check_in', 'form.view_applicants']

const CAPACITY = 40
const PAYER_FEE = 5000
const NON_PAYER_FEE = 10000

// main(앞 회차 견본과 같은 양식): 정원 40, 납부자 5,000·미납자 10,000, 대표 계좌, 이름·학번·휴대폰 + 질문 셋
const BASE: RegistrationForm = {
  id: '0199d1a0-0000-7000-8000-00000000f001',
  eventId: EVENT.id,
  name: '참가 신청',
  opensAt: null,
  closesAt: '2026-11-03T18:00',
  capacity: CAPACITY,
  notice: null,
  collectsPhone: true,
  collectsStudentId: true,
  paused: false,
  publicCode: 'K7Q2M9XA',
  payerFee: PAYER_FEE,
  nonPayerFee: NON_PAYER_FEE,
  feeAccount: { id: MAIN_ACCOUNT.id, name: MAIN_ACCOUNT.name },
  status: 'open',
  applicantCount: 0,
  attendedCount: 0,
  remaining: CAPACITY,
  purgeOn: '2028-02-25',
  missingConditions: [],
  questions: MAIN_QUESTIONS,
  actions: OPEN_ACTIONS,
}

type Over = Partial<RegistrationForm> & { applicantCount: number }

const form = (over: Over): RegistrationForm => ({
  ...BASE,
  remaining: CAPACITY - over.applicantCount,
  ...over,
})

// 초안 = 멈춘 채 신청 0(registrationStatusLabel). 마감과 계좌가 빠졌다.
// 계약은 마감을 꼭 받아(closesAt: string) 지금 서버는 마감 없는 초안을 저장하지 못한다. 견본은 빈 글로 둔다(DEC-93 초안).
const DRAFT_MISSING: FormActivationCondition[] = ['closes_at', 'fee_account']
const draft = (over: Partial<RegistrationForm> = {}) =>
  form({
    applicantCount: 0,
    paused: true,
    status: 'paused',
    actions: PAUSED_ACTIONS,
    ...over,
  })

const ACTIVE_COUNT = 18
const PAUSED_COUNT = 23
const ENDED_ATTENDED = 36

export const FORMS = {
  draft: draft({ closesAt: '', feeAccount: null, missingConditions: DRAFT_MISSING }),
  ready: draft(),
  active: form({ applicantCount: ACTIVE_COUNT }),
  paused: form({
    applicantCount: PAUSED_COUNT,
    paused: true,
    status: 'paused',
    actions: PAUSED_ACTIONS,
  }),
  ended: form({
    applicantCount: CAPACITY,
    attendedCount: ENDED_ATTENDED,
    closesAt: '2026-10-28T18:00',
    status: 'closed',
    actions: CLOSED_ACTIONS,
  }),
  // multi: 행사에 양식 둘(1부 활성, 2부 초안). 2부는 질문 없이 이름·학번만, 참가비 하나 5,000원.
  first: form({
    id: '0199d1a0-0000-7000-8000-00000000f011',
    name: '1부 참가 신청',
    publicCode: 'P4WJ8RTC',
    applicantCount: ACTIVE_COUNT,
  }),
  second: draft({
    id: '0199d1a0-0000-7000-8000-00000000f012',
    name: '2부 참가 신청',
    publicCode: 'H3NV6YDE',
    closesAt: '2026-11-10T18:00',
    capacity: null,
    remaining: null,
    collectsPhone: false,
    payerFee: PAYER_FEE,
    nonPayerFee: PAYER_FEE,
    questions: [],
  }),
} satisfies Record<string, RegistrationForm>
