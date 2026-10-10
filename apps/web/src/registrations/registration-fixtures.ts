import type { RegistrationEntry, RegistrationFormView, RegistrationResponse } from '@vada/contracts'

export const registrationForm = (overrides: Partial<RegistrationFormView> = {}): RegistrationFormView => ({ id: 'f', code: 'ABCD2345', accepting: true,
  opensAt: null, closesAt: '2026-08-19T23:59', capacity: 200, notice: '문의: 학생회실', collectPhone: false, version: 1, state: 'open', count: 2,
  purgeAfter: '2026-09-19', purged: false, updatedAt: '2026-08-01T00:00:00Z', fee: 0, memberFee: null, payments: { count: 0, total: 0 }, checkedIn: 0, ...overrides })
export const entry = (id: string, name: string, studentId: string, phone: string | null = null, overrides: Partial<RegistrationEntry> = {}):
  RegistrationEntry => ({ id, name, studentId, phone, createdAt: '2026-08-02T14:05', duesMember: null, fee: 0, paid: null, checkedIn: null, ...overrides })
export const registrationResponse = (overrides: Partial<RegistrationResponse> = {}): RegistrationResponse => ({ form: registrationForm(),
  registrations: [entry('r1', '김바다', '2022123456'), entry('r2', '이수강', '2023222222')], account: null, roster: null, settled: false, ...overrides })

// 참가비 7,000원·납부자 0원인 참가 신청. 김바다는 납부자, 이수강은 입금 확인, 박참여는 입금 전이다.
export const feeAccount = { bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '학생회' }
export const activeRoster = { label: '2026년 2학기 납부자', useUntil: '2027-02-28' }
export const paidBy = { amount: 7000, at: '2026-08-03T10:00', by: { id: 'p', name: '기획' } }
export const feeForm = (overrides: Partial<RegistrationFormView> = {}) =>
  registrationForm({ fee: 7000, memberFee: 0, count: 3, payments: { count: 1, total: 7000 }, ...overrides })
export const feeEntries = (overrides: Partial<Record<'r1' | 'r2' | 'r3', Partial<RegistrationEntry>>> = {}) => [
  entry('r1', '김바다', '2022123456', null, { duesMember: true, fee: 0, ...overrides.r1 }),
  entry('r2', '이수강', '2023222222', null, { duesMember: false, fee: 7000, paid: paidBy, ...overrides.r2 }),
  entry('r3', '박참여', '2021333333', null, { duesMember: false, fee: 7000, ...overrides.r3 }),
]
export const feeResponse = (overrides: Partial<RegistrationResponse> = {}): RegistrationResponse =>
  registrationResponse({ form: feeForm(), registrations: feeEntries(), account: feeAccount, roster: activeRoster, ...overrides })
