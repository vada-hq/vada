import { dayTimeLabel, type MeetingDetail as Detail } from '@vada/contracts'
import PageActions from '@/components/PageActions'
import PageHeading from '@/components/PageHeading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MEETING_STATUS } from './meeting-text'
import { meetingDuration, meetingTime } from './meeting-view'

function Summary({ meeting, onEvent }: { meeting: Detail; onEvent: (id: string) => void }) {
  const status = MEETING_STATUS[meeting.status]
  return (
    <Card className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <Badge>{meeting.event ? '행사 관련 회의' : '정기·상시 회의'}</Badge>
        {meeting.createdBy && meeting.status !== 'cancelled' && (
          <p className="ml-auto wrap-anywhere text-xs text-muted-foreground">
            만든 사람 {meeting.createdBy.name}
          </p>
        )}
      </div>
      <h2 className="wrap-anywhere text-xl font-semibold">{meeting.title}</h2>
      {meeting.purpose && (
        <p className="wrap-anywhere text-sm whitespace-pre-wrap">{meeting.purpose}</p>
      )}
      {meeting.event && (
        <Button
          variant="link"
          touch
          className="min-w-0 self-start px-0 whitespace-normal"
          onClick={() => onEvent(meeting.event!.id)}
        >
          <span className="wrap-anywhere text-left">{meeting.event.name}</span>
        </Button>
      )}
      {meeting.hostDepartment && (
        <p className="wrap-anywhere text-sm text-muted-foreground">
          주관 {meeting.hostDepartment.name}
        </p>
      )}
      <dl className="grid min-w-0 gap-5 border-t pt-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">
            {meeting.status === 'cancelled' ? '원래 예정 일시' : '예정 일시'}
          </dt>
          <dd className="mt-2 text-sm tabular-nums">
            {meetingTime(meeting.heldAt, meeting.endsAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">예상 시간</dt>
          <dd className="mt-2 text-sm">{meetingDuration(meeting.heldAt, meeting.endsAt)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">장소</dt>
          <dd className="mt-2 wrap-anywhere text-sm">{meeting.place ?? '장소 미정'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">참가자</dt>
          <dd className="mt-2 text-right text-sm tabular-nums">{meeting.attendeeCount}명</dd>
        </div>
      </dl>
    </Card>
  )
}
function Agenda({ meeting }: { meeting: Detail }) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="mb-4 font-semibold">안건</h2>
      {meeting.agenda.length === 0 ? (
        <p className="text-sm text-muted-foreground">안건 없음</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {meeting.agenda.map((item, index) => (
            <li key={item.id} className="flex min-w-0 gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="wrap-anywhere text-sm font-medium">{item.title}</h3>
                {item.body && (
                  <p className="mt-1 wrap-anywhere text-sm whitespace-pre-wrap text-muted-foreground">
                    {item.body}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
function Attendees({ meeting }: { meeting: Detail }) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="mb-4 font-semibold">참가자</h2>
      {meeting.attendees.length === 0 ? (
        <p className="text-sm text-muted-foreground">참가자 없음</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {meeting.attendees.map(person => (
            <li key={person.id} className="wrap-anywhere text-sm">
              {person.name}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
type Props = {
  meeting: Detail
  onEdit: () => void
  onCancel: () => void
  onEvent: (id: string) => void
}
export function MeetingDetail({ meeting, onEdit, onCancel, onEvent }: Props) {
  const cancelled = meeting.status === 'cancelled'
  return (
    <>
      <PageHeading trail={{ title: '회의', crumbs: [{ label: meeting.title, truncate: true }] }}>
        <h1 className="text-xl font-semibold">회의</h1>
      </PageHeading>
      {!cancelled && (
        <PageActions>
          {meeting.actions.includes('meeting.edit') && (
            <Button variant="outline" touch onClick={onEdit}>
              고치기
            </Button>
          )}
          {meeting.actions.includes('meeting.cancel') && (
            <Button variant="outline" touch onClick={onCancel}>
              회의 취소
            </Button>
          )}
        </PageActions>
      )}
      {cancelled && (
        <div className="flex min-w-0 gap-3 rounded-sm border border-gray-200 bg-gray-50 p-4">
          <Badge>취소</Badge>
          <div className="min-w-0">
            <p className="text-sm font-medium">취소된 회의</p>
            <p className="mt-1 wrap-anywhere text-sm text-muted-foreground">
              {meeting.cancelReason}
            </p>
          </div>
        </div>
      )}
      <Summary meeting={meeting} onEvent={onEvent} />
      {cancelled ? (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="font-semibold">취소 기록</h2>
          <dl className="flex flex-col gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">취소 사유</dt>
              <dd className="mt-2 wrap-anywhere whitespace-pre-wrap">{meeting.cancelReason}</dd>
            </div>
            {meeting.cancelledAt && (
              <div>
                <dt className="text-xs text-muted-foreground">취소 시각</dt>
                <dd className="mt-2 tabular-nums">{dayTimeLabel(meeting.cancelledAt)}</dd>
              </div>
            )}
          </dl>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          <Agenda meeting={meeting} />
          <Attendees meeting={meeting} />
        </div>
      )}
    </>
  )
}
