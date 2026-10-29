import type { MeetingStatus, MeetingSummary } from '@vada/contracts'
import { changeErrors } from '@/lib/change-errors'
import { MINUTES_TEXT } from './minutes-text'

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
// 내 회의 줄의 할 일 문구와 색(와이어프레임 MEET-MY-01: 파랑·주황·회색). 완료·취소는 mine에 오지 않지만 상태 이름으로 둔다.
export const MY_MEETING_TODO: Record<MeetingStatus, { label: string; className: string }> = {
  in_progress: { label: '진행 중', className: 'text-blue-700' },
  wrapping_up: { label: '회의록 정리 필요', className: 'text-orange-700' },
  scheduled: { label: '참석 예정', className: 'text-muted-foreground' },
  done: { label: '완료', className: 'text-muted-foreground' },
  cancelled: { label: '취소', className: 'text-muted-foreground' },
}
export const MINUTES_STATUS = { none: '작성 전', draft: '작성 중', confirmed: '정리 완료' }
export const MEETING_LOAD_FAILED = '회의를 불러오지 못했어요. 연결을 확인해 주세요.'
export const MEETING_OPTIONS_FAILED = '선택지를 불러오지 못했어요. 다시 시도해 주세요.'
export const MEETING_LOST = '이 회의를 볼 수 없어요.'
const MEETING_ERRORS = changeErrors({
  MEETING_CANCELLED: '이미 취소된 회의예요. 새로 불러와 주세요.',
  MEETING_HAS_TASKS: '후속 업무가 있는 회의는 취소할 수 없어요.',
  AGENDA_IN_USE: '결정이나 후속 업무가 있는 안건은 뺄 수 없어요.',
  RECORD_CONFIRMED: '확정된 회의록이에요. 새로 불러와 주세요.',
  REASON_REQUIRED: '사유를 입력해 주세요.',
  EVENT_COMPLETED: '완료한 행사에는 새로 연결할 수 없어요. 다른 행사를 골라 주세요.',
  VERSION_CONFLICT: '다른 사람이 먼저 고쳤어요. 새로 불러온 내용을 확인하고 다시 저장해 주세요.',
  FORBIDDEN: '지금은 이 회의를 바꿀 수 없어요.',
  NOT_FOUND: MEETING_LOST,
  INVALID_INPUT: '입력한 내용을 확인해 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
})
export const meetingError = (code: string) =>
  MEETING_ERRORS[code] ?? '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const ATTENDEES_SAVED_BUT = (problem: string) => `참가자는 저장했어요. ${problem}`
export const MEETING_FIELD_ERROR = '길이나 입력한 글자를 확인해 주세요.'
export function minutesButton(meeting: MeetingSummary) {
  if (meeting.status === 'cancelled') return '취소 내용 보기'
  if (meeting.status === 'scheduled') return '상세 보기'
  if (!meeting.actions.includes('meeting.minutes') || meeting.status === 'done')
    return MINUTES_TEXT.view
  return meeting.status === 'in_progress' ? MINUTES_TEXT.write : MINUTES_TEXT.arrange
}
