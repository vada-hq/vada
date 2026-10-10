import type { RegistrationEntry, RegistrationFormView, RegistrationResponse } from '@vada/contracts'

export const registrationForm = (overrides: Partial<RegistrationFormView> = {}): RegistrationFormView => ({ id: 'f', code: 'ABCD2345', accepting: true,
  opensAt: null, closesAt: '2026-08-19T23:59', capacity: 200, notice: '문의: 학생회실', collectPhone: false, version: 1, state: 'open', count: 2,
  purgeAfter: '2026-09-19', purged: false, updatedAt: '2026-08-01T00:00:00Z', ...overrides })
export const entry = (id: string, name: string, studentId: string, phone: string | null = null): RegistrationEntry =>
  ({ id, name, studentId, phone, createdAt: '2026-08-02T14:05' })
export const registrationResponse = (overrides: Partial<RegistrationResponse> = {}): RegistrationResponse => ({ form: registrationForm(),
  registrations: [entry('r1', '김바다', '2022123456'), entry('r2', '이수강', '2023222222')], ...overrides })
