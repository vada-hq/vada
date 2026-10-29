import type { MeetingDetail } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import { Badge } from '@/components/ui/badge'
import { MEETING_STATUS } from './meeting-text'
import { MeetingActions } from './MeetingActions'
import { MinutesConfirm } from './MinutesConfirm'
import { meetingTime } from './meeting-view'
import { participantCount } from './minutes-text'

export function MinutesHeader({
  meeting,
  onEdit,
  onCancel,
  onConfirm,
}: {
  meeting: MeetingDetail
  onEdit?: (() => void) | undefined
  onCancel?: (() => void) | undefined
  onConfirm: () => Promise<string | null>
}) {
  const status = MEETING_STATUS[meeting.status]
  return (
    <>
      <PageHeading trail={{ title: '회의', crumbs: [{ label: meeting.title, truncate: true }] }}>
        <h1 className="wrap-anywhere text-xl font-semibold">{meeting.title}</h1>
      </PageHeading>
      <MeetingActions meeting={meeting} onEdit={onEdit} onCancel={onCancel} />
      <MinutesConfirm meeting={meeting} onConfirm={onConfirm} />
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b pb-4 text-sm text-muted-foreground">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="tabular-nums">{meetingTime(meeting.heldAt, meeting.endsAt)}</span>
        {meeting.place && <span className="wrap-anywhere">{meeting.place}</span>}
        <span className="sm:ml-auto">{participantCount(meeting.attendeeCount)}</span>
      </div>
    </>
  )
}
