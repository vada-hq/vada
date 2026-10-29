import type { MeetingDetail } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { openRecord } from '@/lib/go-to'
import { meetingTime } from './meeting-view'
import { minutesCounts } from './minutes-confirm'
import { MINUTES_TEXT as T, doneDecisionCount } from './minutes-text'

export function MinutesDoneSummary({
  meeting,
  councilId,
}: {
  meeting: MeetingDetail
  councilId: string
}) {
  const counts = minutesCounts(meeting)
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:justify-between sm:p-6">
      <div className="flex min-w-0 flex-col items-start gap-2">
        {meeting.event && (
          <Button
            variant="link"
            touch
            className="h-auto max-w-full justify-start p-0 text-left whitespace-normal"
            onClick={() => openRecord('events', councilId, meeting.event!.id, { tab: 'overview' })}
          >
            <span className="wrap-anywhere">{meeting.event.name}</span>
          </Button>
        )}
        <h2 className="wrap-anywhere text-base font-semibold">{meeting.title}</h2>
        <p className="wrap-anywhere text-xs text-muted-foreground tabular-nums">
          {meetingTime(meeting.heldAt, meeting.endsAt)}
          {meeting.place ? ` · ${meeting.place}` : ''}
        </p>
      </div>
      <dl className="flex shrink-0 justify-end gap-5 text-right text-xs text-muted-foreground tabular-nums">
        <div className="flex flex-col gap-1">
          <dt>{T.attendeeList}</dt>
          <dd className="text-sm font-semibold text-foreground">{meeting.attendeeCount}명</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>{T.decisionLabel}</dt>
          <dd
            className={`text-sm font-semibold ${counts.decisions ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {doneDecisionCount(counts.decisions)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>{T.followUps}</dt>
          <dd
            className={`text-sm font-semibold ${counts.followUps ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {doneDecisionCount(counts.followUps)}
          </dd>
        </div>
      </dl>
    </Card>
  )
}
