import type { RegistrationEntry, RegistrationFormView, RegistrationState } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'
import { applyPath } from '../public/public-route'
import { won } from '../public/registration-text'

export const registrationBase = (organizationId: string, eventId: string) =>
  `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/registration`
// 학생들에게 나눠 줄 공개 신청 링크
export const applyUrl = (code: string, origin = window.location.origin) => `${origin}${applyPath(code)}`
export const countText = (count: number, capacity: number | null) => capacity === null ? `${count}명` : `${count}/${capacity}명`
const digits = (value: string) => value.replace(/[\s-]/g, '')
// 이름의 일부나 학번의 일부로 찾는다. 학번에 넣은 하이픈·공백은 무시한다.
export function findRegistrants(list: RegistrationEntry[], query: string) {
  const text = query.trim()
  if (!text) return list
  const number = digits(text)
  return list.filter(item => item.name.includes(text) || (number !== '' && item.studentId.includes(number)))
}
const tones: Record<RegistrationState, Tone> = { open: 'success', upcoming: 'info', full: 'warning', paused: 'danger', closed: 'neutral' }
export const stateTone = (state: RegistrationState) => tones[state]

// 참가 신청 카드의 참가비 줄
export function feeText(form: Pick<RegistrationFormView, 'fee' | 'memberFee'>) {
  if (form.fee === 0 && form.memberFee === null) return '없음'
  return form.memberFee === null ? won(form.fee) : `${won(form.fee)} · 학생회비 납부자 ${won(form.memberFee)}`
}
// 참가비를 다루는 참가 신청이면 명단에 입금 거르기와 칩을 둔다. 무료로 바꿨어도 받은 참가비가 있으면 둔다.
export const hasFees = (form: Pick<RegistrationFormView, 'fee' | 'memberFee' | 'payments'>) =>
  form.fee > 0 || form.memberFee !== null || form.payments.count > 0
export type RegistrantFilter = 'all' | 'unpaid' | 'paid' | 'checkedIn' | 'notCheckedIn'
// 입금 전: 낼 돈이 있고 확인 전인 신청. 입금 확인: 확인한 신청. 참석·참석 전: 참석을 확인했는지.
export function filterRegistrants(list: RegistrationEntry[], filter: RegistrantFilter) {
  if (filter === 'unpaid') return list.filter(item => item.fee > 0 && item.paid === null)
  if (filter === 'paid') return list.filter(item => item.paid !== null)
  if (filter === 'checkedIn') return list.filter(item => item.checkedIn !== null)
  if (filter === 'notCheckedIn') return list.filter(item => item.checkedIn === null)
  return list
}
export function paymentChip(item: RegistrationEntry): { text: string; tone: Tone } {
  if (item.paid) return { text: `${won(item.paid.amount)} · 입금 확인`, tone: 'success' }
  if (item.fee === 0) return { text: '참가비 없음', tone: 'neutral' }
  return { text: `${won(item.fee)} · 입금 전`, tone: 'warning' }
}
