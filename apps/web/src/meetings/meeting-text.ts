import type { MeetingStatus } from '@vada/contracts'
import { changeErrors } from '@/lib/change-errors'

export const MEETING_STATUS: Record<
  MeetingStatus,
  { label: string; tone: 'info' | 'success' | 'warning' | 'neutral' }
> = {
  scheduled: { label: '예정', tone: 'info' },
  in_progress: { label: '진행 중', tone: 'success' },
  wrapping_up: { label: '정리 중', tone: 'warning' },
  done: { label: '완료', tone: 'neutral' },
  cancelled: { label: '취소', tone: 'neutral' },
}
export const MINUTES_STATUS = { none: '작성 전', draft: '작성 중', confirmed: '정리 완료' }
export const MEETING_LOAD_FAILED = '회의를 불러오지 못했어요. 연결을 확인해 주세요.'
export const MEETING_OPTIONS_FAILED = '선택지를 불러오지 못했어요. 다시 시도해 주세요.'
export const MEETING_LOST = '이 회의를 볼 수 없어요.'
export const MEETING_ERRORS = changeErrors({
  MEETING_CANCELLED: '이미 취소된 회의예요. 새로 불러와 주세요.',
  MEETING_HAS_TASKS: '후속 업무가 있는 회의는 취소할 수 없어요.',
  EVENT_COMPLETED: '완료한 행사에는 새로 연결할 수 없어요. 다른 행사를 골라 주세요.',
  VERSION_CONFLICT: '다른 사람이 먼저 고쳤어요. 새로 불러온 내용을 확인하고 다시 저장해 주세요.',
  FORBIDDEN: '지금은 이 회의를 바꿀 수 없어요.',
  NOT_FOUND: MEETING_LOST,
  INVALID_INPUT: '입력한 내용을 확인해 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
})
export const meetingError = (code: string) =>
  MEETING_ERRORS[code] ?? '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const MEETING_FIELD_ERROR = '길이나 입력한 글자를 확인해 주세요.'
