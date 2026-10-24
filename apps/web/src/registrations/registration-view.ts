import type { Applicant, ApplicantAction, DepositStatus, RegistrationForm } from '@vada/contracts'
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

// 이 화면에서 바꾼 출석·입금이 서버가 읽어 준 줄의 동작을 낡게 한다(목록을 다시 읽으면 열람 기록이 남아 읽지 않는다).
// 서버 정책(registrations/policy.ts)이 한 줄에 주는 동작의 모양을 그 쓰기의 결과 하나만큼 옮긴다. 사람이 그 동작을 할 수 있는지는 줄이 가진 동작으로만 안다(없던 동작을 더하지 않는다).
const swap = (actions: ApplicantAction[], drop: ApplicantAction[], add: ApplicantAction[]) => {
  const rest = actions.filter(action => !drop.includes(action))
  return actions.some(action => drop.includes(action)) ? [...rest, ...add] : rest
}

// 출석: 출석한 줄은 출석 취소만, 아닌 줄은 출석과 신청 취소다(N10).
export function actionsWhenAttended(actions: ApplicantAction[], attended: boolean) {
  const mine: ApplicantAction[] = ['registration.check_in', 'registration.cancel_check_in']
  const has = actions.some(action => mine.includes(action))
  const rest = actions.filter(action => !mine.includes(action) && action !== 'registration.cancel')
  if (!has) return actions
  return attended
    ? [...rest, 'registration.cancel_check_in' as const]
    : [...rest, 'registration.check_in' as const, 'registration.cancel' as const]
}

// 입금: 확인한 입금은 확인 취소만, 없으면 입금 확인이다. 환불 대기가 되면 환불함이 생기는지는 서버만 알아 목록을 다시 읽는다.
export function actionsWhenDeposit(actions: ApplicantAction[], status: DepositStatus) {
  const depositActions: ApplicantAction[] = ['deposit.confirm', 'deposit.cancel', 'deposit.refund']
  return swap(actions, depositActions, [status === 'none' ? 'deposit.confirm' : 'deposit.cancel'])
}

// 취소한 줄에는 출석·신청 취소가 없다.
export const actionsWhenCancelled = (actions: ApplicantAction[]) =>
  actions.filter(action => !action.startsWith('registration.'))

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
