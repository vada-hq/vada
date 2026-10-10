import type { DuesRosterView, FeeAccountView, FeeSettingsResponse } from '@vada/contracts'

export const feeAccount = (overrides: Partial<FeeAccountView> = {}): FeeAccountView => ({ bank: '카카오뱅크', accountNumber: '3333-01-1234567',
  holder: '컴퓨터학부 학생회', version: 1, updatedAt: '2026-10-01T03:00:00Z', updatedBy: { id: 'f', name: '김민준' }, ...overrides })
export const duesRoster = (overrides: Partial<DuesRosterView> = {}): DuesRosterView => ({ label: '2026년 2학기 납부자', useUntil: '2027-02-28',
  version: 1, uploadedAt: '2026-10-01T03:00:00Z', uploadedBy: { id: 'f', name: '김민준' },
  members: [{ studentId: '2022000001', name: '김바다' }, { studentId: '2022000002', name: '박해랑' }, { studentId: '2023000003', name: '김하늘' }],
  ...overrides })
export const feeSettings = (overrides: Partial<FeeSettingsResponse> = {}): FeeSettingsResponse => ({ account: feeAccount(),
  accountHistory: [{ id: 'h1', actor: { id: 'f', name: '김민준' }, from: null, to: { bank: '카카오뱅크', accountNumber: '3333-01-1234567',
    holder: '컴퓨터학부 학생회' }, createdAt: '2026-10-01T03:00:00Z' }], roster: duesRoster(), ...overrides })
