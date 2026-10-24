import type { Applicant, DepositStatus, RegistrationForm } from '@vada/contracts'
import { momentLabel } from '@/events/event-view'

// '10월 24일 (토) 14:00 ~ 10월 25일 (일) 18:00'. 시작이 없으면 마감만 적는다.
export const periodLabel = (form: Pick<RegistrationForm, 'opensAt' | 'closesAt'>) =>
  form.opensAt === null
    ? `${momentLabel(form.closesAt)}까지`
    : `${momentLabel(form.opensAt)} ~ ${momentLabel(form.closesAt)}`

// '신청 3/50명 · 출석 1명'. 정원이 없으면 신청 수만 적는다.
export const countLabel = (
  form: Pick<RegistrationForm, 'applicantCount' | 'capacity' | 'attendedCount'>,
) =>
  `신청 ${form.applicantCount}${form.capacity === null ? '' : `/${form.capacity}`}명 · 출석 ${form.attendedCount}명`

// 학생이 여는 공개 링크. 카톡방에 올리고 포스터 QR로 찍는다.
export const applyUrl = (publicCode: string) => `${window.location.origin}/apply/${publicCode}`

// 신청자 줄에서 할 수 있는 동작. 모두 서버가 준 것(양식 actions, 내 권한 목록)으로만 켠다.
export type StaffCan = {
  // 출석·신청 취소(form.check_in)
  manage: boolean
  // 환불함(finance.manage)
  refund: boolean
}

export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  none: '입금 안 함',
  confirmed: '입금 확인',
  refund_pending: '환불 대기',
  refunded: '환불함',
}

export type ApplicantView = 'all' | 'unpaid' | 'refund_pending'

// 입금 안 함은 아직 취소하지 않고 입금 기록이 없는 신청이다. 환불 대기는 취소했고 입금이 남은 신청이다.
export function inView(applicant: Pick<Applicant, 'cancelled' | 'deposit'>, view: ApplicantView) {
  if (view === 'unpaid') return !applicant.cancelled && applicant.deposit.status === 'none'
  if (view === 'refund_pending') return applicant.deposit.status === 'refund_pending'
  return true
}
