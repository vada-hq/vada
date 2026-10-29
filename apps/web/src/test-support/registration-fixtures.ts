import type { MyRegistration, PublicRegistrationForm } from '@vada/contracts'

export const FORM_CODE = 'ABCD2345'
export const FORM_PATH = `/api/public/registration-forms/${FORM_CODE}`
export const APPLY_PATH = `${FORM_PATH}/apply`
export const LOOKUP_PATH = '/api/public/registrations/lookup'
export const CANCEL_PATH = '/api/public/registrations/cancel'

export const publicForm = (
  extra: Partial<PublicRegistrationForm> = {},
): PublicRegistrationForm => ({
  councilName: '소프트웨어학부 학생회',
  event: {
    name: '신입생 환영회',
    startsAt: '2026-10-24T14:00',
    endsAt: '2026-10-24T18:00',
    place: '대강당',
  },
  form: {
    name: '환영회 참가 신청',
    opensAt: null,
    closesAt: '2026-10-23T18:00',
    notice: '문의는 카카오톡 오픈채팅으로 해 주세요.',
  },
  status: 'open',
  remaining: 12,
  payerFee: 5000,
  nonPayerFee: 10000,
  collectsStudentId: true,
  collectsPhone: false,
  purgeOn: '2027-10-24',
  questions: [],
  ...extra,
})

export const myRegistration = (extra: Partial<MyRegistration> = {}): MyRegistration => ({
  event: { name: publicForm().event.name },
  form: { notice: publicForm().form.notice },
  mine: { name: '김새내', studentId: '20260001', phone: null },
  answers: [],
  appliedFee: 5000,
  depositConfirmed: false,
  account: { bank: '국민은행', accountNumber: '123-456-789012', holder: '소프트웨어학부 학생회' },
  qrText: `VADA:${'0123456789ABCDEF'.repeat(4)}`,
  attended: false,
  cancellable: true,
  ...extra,
})
