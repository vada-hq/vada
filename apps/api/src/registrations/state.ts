import { REGISTRATION_RETENTION_DAYS, type RegistrationState } from '@vada/contracts'

type FormTimes = { accepting: boolean; opensAt: Date | null; closesAt: Date; capacity: number | null }
// 위에서부터 먼저 맞는 것이다. 마감이 지나면 멈춤이어도 마감이고, 시작 전이면 정원이 차 있어도 시작 전이다.
export function stateOf(form: FormTimes, count: number, now: Date): RegistrationState {
  if (now >= form.closesAt) return 'closed'
  if (!form.accepting) return 'paused'
  if (form.opensAt && now < form.opensAt) return 'upcoming'
  if (form.capacity !== null && count >= form.capacity) return 'full'
  return 'open'
}
// 행사 끝: 끝 일시가 없으면 시작 일시다.
export const eventEnd = (event: { startsAt: Date | null; endsAt: Date | null }) => event.endsAt ?? event.startsAt
// 행사 끝에서 보관 기간이 지나면 신청자 정보를 지운다.
export const purgeAfterOf = (end: Date) => new Date(end.getTime() + REGISTRATION_RETENTION_DAYS * 86_400_000)
