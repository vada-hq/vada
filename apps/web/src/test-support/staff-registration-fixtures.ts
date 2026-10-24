import type {
  AccountItem,
  Applicant,
  ApplicantChange,
  FormAction,
  RegistrationForm,
} from '@vada/contracts'

export const STAFF_EVENT_ID = '00000000-0000-4000-8000-0000000000e1'
const FORM_ID = '00000000-0000-4000-8000-0000000000f1'
export const ACCOUNT_ID = '00000000-0000-4000-8000-0000000000a1'
export const REGISTRATION_ID = '00000000-0000-4000-8000-0000000000a1'
const BASE = '/api/organizations/c1'
export const FORMS_PATH = `${BASE}/events/${STAFF_EVENT_ID}/registration-forms`
export const FORM_PATH = `${BASE}/registration-forms/${FORM_ID}`
export const APPLICANTS_PATH = `${FORM_PATH}/applicants`
export const CHECK_IN_PATH = `${BASE}/events/${STAFF_EVENT_ID}/check-in`
export const ACCOUNTS_PATH = `${BASE}/accounts`

// 서버가 줄 수 있는 조합: 멈춘 양식에는 멈추기 대신 다시 받기가 온다.
const MANAGE: FormAction[] = ['form.update', 'form.pause', 'form.check_in', 'form.view_applicants']
const MANAGE_PAUSED: FormAction[] = MANAGE.map(a => (a === 'form.pause' ? 'form.resume' : a))

export const staffForm = (extra: Partial<RegistrationForm> = {}): RegistrationForm => ({
  id: FORM_ID,
  eventId: STAFF_EVENT_ID,
  name: '환영회 참가 신청',
  opensAt: null,
  closesAt: '2026-10-23T18:00',
  capacity: 50,
  notice: null,
  collectsPhone: false,
  collectsStudentId: true,
  paused: false,
  publicCode: 'ABCD2345',
  payerFee: 5000,
  nonPayerFee: 10000,
  feeAccount: { id: ACCOUNT_ID, name: '학생회 통장' },
  status: 'open',
  applicantCount: 3,
  attendedCount: 1,
  remaining: 47,
  purgeOn: '2027-10-24',
  actions: extra.paused ? MANAGE_PAUSED : MANAGE,
  ...extra,
})

export const applicant = (extra: Partial<Applicant> = {}): Applicant => ({
  id: REGISTRATION_ID,
  name: '김새내',
  studentId: '20260001',
  phone: null,
  appliedFee: 5000,
  payer: true,
  duplicateStudentId: false,
  attended: false,
  appliedAt: '2026-10-20T05:00:00.000Z',
  cancelled: false,
  deposit: { status: 'none', amount: null },
  actions: ['registration.check_in', 'registration.cancel', 'deposit.confirm'],
  ...extra,
})

// 쓰기가 돌려주는 줄의 새 모습(서버가 센 것). 기본은 출석한 줄이다.
export const applicantChange = (extra: Partial<ApplicantChange> = {}): ApplicantChange => ({
  id: REGISTRATION_ID,
  attended: true,
  cancelled: false,
  deposit: { status: 'none', amount: null },
  actions: ['registration.cancel_check_in', 'deposit.confirm'],
  ...extra,
})

export const accountItem = (extra: Partial<AccountItem> = {}): AccountItem => ({
  id: ACCOUNT_ID,
  name: '학생회 통장',
  bank: '국민은행',
  accountNumber: '123-456-789012',
  holder: '소프트웨어학부 학생회',
  type: 'main',
  closedOn: null,
  actions: [],
  ...extra,
})
