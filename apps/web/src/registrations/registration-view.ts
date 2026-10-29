import type { Applicant, RegistrationForm } from '@vada/contracts'
import { momentLabel } from '@/events/event-view'

// '10월 24일 (토) 14:00 ~ 10월 25일 (일) 18:00'. 시작이 없으면 마감만 적는다.
export const periodLabel = (form: Pick<RegistrationForm, 'opensAt' | 'closesAt'>) =>
  form.opensAt === null
    ? `${momentLabel(form.closesAt)}까지`
    : `${momentLabel(form.opensAt)} ~ ${momentLabel(form.closesAt)}`

// 학생이 여는 공개 링크. 카톡방에 올리고 포스터 QR로 찍는다.
export const applyUrl = (publicCode: string) => `${window.location.origin}/apply/${publicCode}`

export { DEPOSIT_LABEL } from '@/lib/registration-messages'

export type ApplicantView = 'all' | 'unpaid' | 'refund_pending'

// 입금 안 함은 아직 취소하지 않고 입금 기록이 없는 신청이다. 환불 대기는 취소했고 입금이 남은 신청이다.
export function inView(applicant: Pick<Applicant, 'cancelled' | 'deposit'>, view: ApplicantView) {
  if (view === 'unpaid') return !applicant.cancelled && applicant.deposit.status === 'none'
  if (view === 'refund_pending') return applicant.deposit.status === 'refund_pending'
  return true
}
