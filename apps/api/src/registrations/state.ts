import type { RegistrationStatus } from '@vada/contracts'

type StateInput = {
  opensAt: Date | null
  closesAt: Date
  paused: boolean
  capacity: number | null
  // 취소하지 않은 신청 수
  applicantCount: number
  // 그 행사를 완료했는가. 완료한 행사의 양식은 받지 않는다(RULE-11).
  eventCompleted: boolean
}

// 마감 시각이 지났는가. 상태와 정책(멈추기·다시 받기)이 같은 판단을 쓴다.
export const isFormClosed = (closesAt: Date, now: Date) => now.getTime() >= closesAt.getTime()

// 상태는 저장하지 않고 센다. 운영진 응답, 공개 응답, 신청이 이 함수 하나를 쓴다. 앞에서 맞는 것이 상태다: 마감(완료한 행사, 지금 ≥ 마감) → 멈춤 → 시작 전 → 정원 참 → 받는 중.
// 초안도 paused로 막아 공개 읽기와 신청이 같은 판정을 쓴다. 정원을 지금 신청 수보다 줄여도 되므로 정원 참은 '같거나 많음'이다.
export function registrationStatusOf(form: StateInput, now: Date): RegistrationStatus {
  if (form.eventCompleted || isFormClosed(form.closesAt, now)) return 'closed'
  if (form.paused) return 'paused'
  if (form.opensAt && now.getTime() < form.opensAt.getTime()) return 'before_open'
  if (form.capacity !== null && form.applicantCount >= form.capacity) return 'full'
  return 'open'
}

// 남은 자리. 정원이 없으면 null이고, 정원을 줄여 넘쳤으면 0이다.
export const remainingOf = (capacity: number | null, applicantCount: number) =>
  capacity === null ? null : Math.max(0, capacity - applicantCount)
