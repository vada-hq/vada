import type { MeetingStatus } from '@vada/contracts'

export function statusOf(
  meeting: {
    heldAt: Date
    endsAt: Date | null
    cancelledAt: Date | null
    confirmedAt: Date | null
  },
  now: Date,
): MeetingStatus {
  if (meeting.cancelledAt) return 'cancelled'
  if (meeting.confirmedAt) return 'done'
  if (now < meeting.heldAt) return 'scheduled'
  // 끝이 없는 옛 회의는 확정하거나 일시를 보완할 때까지 진행 중이다.
  return meeting.endsAt && now >= meeting.endsAt ? 'wrapping_up' : 'in_progress'
}
