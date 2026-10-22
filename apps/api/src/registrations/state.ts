import type { RegistrationStatus } from '@vada/contracts'

type StateInput = {
  opensAt: Date | null
  closesAt: Date
  paused: boolean
  capacity: number | null
  // 취소하지 않은 신청 수
  applicantCount: number
}

// 상태는 저장하지 않고 센다. 앞에서 맞는 것이 상태다: 마감(지금 ≥ 마감) → 멈춤 → 시작 전 → 정원 참 → 받는 중.
// 정원을 지금 신청 수보다 줄여도 되므로, 정원 참은 '같거나 많음'으로 본다.
export function registrationStatusOf(form: StateInput, now: Date): RegistrationStatus {
  if (now.getTime() >= form.closesAt.getTime()) return 'closed'
  if (form.paused) return 'paused'
  if (form.opensAt && now.getTime() < form.opensAt.getTime()) return 'before_open'
  if (form.capacity !== null && form.applicantCount >= form.capacity) return 'full'
  return 'open'
}

// 남은 자리. 정원이 없으면 null이고, 정원을 줄여 넘쳤으면 0이다.
export const remainingOf = (capacity: number | null, applicantCount: number) =>
  capacity === null ? null : Math.max(0, capacity - applicantCount)
