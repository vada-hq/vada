import type { RegistrationEntry, RegistrationState } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'
import { applyPath } from '../public/public-route'

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
