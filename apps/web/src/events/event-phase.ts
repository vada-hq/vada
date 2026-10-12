import { eventPhaseOf, type EventPhase } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'

// 단계 계산은 운영 현황 서버(M6)와 같이 쓰도록 contracts에 있다.
export { eventPhaseOf, type EventPhase }
export const phaseLabels: Record<EventPhase, string> = { planning: '기획 중', ongoing: '진행 중', wrapping: '정리 중', completed: '완료' }
export const phaseTones: Record<EventPhase, Tone> = { planning: 'info', ongoing: 'success', wrapping: 'warning', completed: 'neutral' }
// 모듈마다 오류 문구에 같은 말을 쓴다(서버 EVENT_COMPLETED).
export const completedEventMessage = '완료한 행사라 바꿀 수 없어요. 바꾸려면 회장단이 완료를 취소해야 해요.'
