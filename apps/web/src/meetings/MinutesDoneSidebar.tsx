import type { MeetingDetail } from '@vada/contracts'
import { Card } from '@/components/ui/card'
import { FollowUpRow } from './MinutesFollowUps'
import { MINUTES_TEXT as T } from './minutes-text'

export function MinutesDoneSidebar({
  meeting,
  councilId,
}: {
  meeting: MeetingDetail
  councilId: string
}) {
  const followUps = meeting.agenda.flatMap(item => item.followUps)
  return (
    <aside className="flex min-w-0 flex-col gap-5">
      <Card className="flex min-w-0 flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold">{T.followUpProgress}</h2>
        {followUps.length ? (
          <ul className="flex min-w-0 flex-col gap-2">
            {followUps.map(task => (
              <li key={task.id}>
                <FollowUpRow councilId={councilId} task={task} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{T.emptyFollowUps}</p>
        )}
      </Card>
      <Card className="flex min-w-0 flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold">{T.attendeeList}</h2>
        {meeting.attendees.length ? (
          <ul className="flex flex-col gap-3">
            {meeting.attendees.map(person => (
              <li key={person.id} className="wrap-anywhere text-sm">
                {person.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{T.emptyParticipants}</p>
        )}
      </Card>
    </aside>
  )
}
