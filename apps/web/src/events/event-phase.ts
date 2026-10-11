import type { EventSummary } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'

export type EventPhase = 'planning' | 'ongoing' | 'wrapping' | 'completed'
export const phaseLabels: Record<EventPhase, string> = { planning: '기획 중', ongoing: '진행 중', wrapping: '정리 중', completed: '완료' }
export const phaseTones: Record<EventPhase, Tone> = { planning: 'info', ongoing: 'success', wrapping: 'warning', completed: 'neutral' }
// 모듈마다 오류 문구에 같은 말을 쓴다(서버 EVENT_COMPLETED).
export const completedEventMessage = '완료한 행사라 바꿀 수 없어요. 바꾸려면 회장단이 완료를 취소해야 해요.'

// 행사 단계(M5a). 저장하지 않고 날짜로 계산한다. now와 행사 일시는 한국 시각 "YYYY-MM-DDTHH:mm"이라 글자로 비교한다.
// 끝 일시가 없으면 시작한 날(한국 날짜)이 끝날 때까지 진행 중이다.
export function eventPhaseOf(event: Pick<EventSummary, 'startsAt' | 'endsAt' | 'completedAt'>, now: string): EventPhase {
  if (event.completedAt) return 'completed'
  if (!event.startsAt || now < event.startsAt) return 'planning'
  if (event.endsAt) return now < event.endsAt ? 'ongoing' : 'wrapping'
  return now.slice(0, 10) === event.startsAt.slice(0, 10) ? 'ongoing' : 'wrapping'
}
