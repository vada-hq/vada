import { useId } from 'react'
import { CalendarDays, ChevronRight, MapPin, Users } from 'lucide-react'
import {
  koreanOf,
  menuPath,
  statusOf,
  type MeetingsResponse,
  type MeetingStatus,
  type MeetingSummary,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { navigate } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { useNow } from '@/lib/use-now'
import { usePolledRead } from '@/lib/use-polled-read'
import { cn } from '@/lib/utils'
import { MeetingReadFailure } from './MeetingReadFailure'
import { MEETING_LIST_TRUNCATED, MEETING_LOAD_FAILED, MEETING_STATUS } from './meeting-text'
import { meetingTime, sortedMeetings } from './meeting-view'

type Props = {
  councilId: string
  eventId: string
  onForbidden: () => void
  referenceTime?: string
}

// 와이어프레임 EVT-MEET-01의 요약 줄 차례. 취소는 있을 때만 붙인다.
const SUMMARY: MeetingStatus[] = ['in_progress', 'scheduled', 'wrapping_up', 'done']
function summaryOf(meetings: MeetingSummary[]) {
  const count = (status: MeetingStatus) => meetings.filter(item => item.status === status).length
  const shown = count('cancelled') > 0 ? [...SUMMARY, 'cancelled' as const] : SUMMARY
  return shown.map(status => `${MEETING_STATUS[status].label} ${count(status)}건`).join(' · ')
}

function EventMeetingCard({ meeting, onOpen }: { meeting: MeetingSummary; onOpen: () => void }) {
  const status = MEETING_STATUS[meeting.status]
  return (
    <Card
      className={cn(
        rowLinkBox,
        'flex min-w-0 items-center gap-3 p-5 transition-colors hover:border-blue-300',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <h3 className="w-full min-w-0">
          <Button
            variant="link"
            className={cn(
              'h-auto min-w-0 justify-start p-0 text-left text-base font-semibold whitespace-normal text-foreground',
              rowLinkTarget,
            )}
            onClick={onOpen}
          >
            <span className="wrap-anywhere">{meeting.title}</span>
          </Button>
        </h3>
        <p className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            {meetingTime(meeting.heldAt, meeting.endsAt)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
            <MapPin aria-hidden className="size-4 shrink-0" />
            {meeting.place ?? '장소 미정'}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users aria-hidden className="size-4 shrink-0" />
            참가 {meeting.attendeeCount}명
          </span>
        </p>
      </div>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-gray-300" />
    </Card>
  )
}

type ListProps = {
  meetings: MeetingSummary[]
  // 서버가 목록 상한에서 잘랐다. 요약 줄의 수도 보이는 회의만 센 것이다.
  truncated: boolean
  // 한국 시각(YYYY-MM-DDTHH:mm). 다가오는 회의를 먼저 둔다.
  now: string
  onOpen: (id: string) => void
  // 회의 메뉴의 학생회 회의로 간다.
  onAll: () => void
}

// 행사 회의 목록(EVT-MEET-01): 요약 줄, [전체 회의 보기], 회의 카드. 만들기·고치기는 회의 메뉴에서 한다.
export function EventMeetingList({ meetings, truncated, now, onOpen, onAll }: ListProps) {
  const titleId = useId()
  const sorted = sortedMeetings(meetings, now)
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3 break-keep">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold">
            관련 회의
          </h2>
          {sorted.length > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">{summaryOf(sorted)}</p>
          )}
        </div>
        <Button variant="outline" touch className="shrink-0" onClick={onAll}>
          전체 회의 보기
        </Button>
      </div>
      {sorted.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">회의 없음</Card>
      ) : (
        sorted.map(meeting => (
          <EventMeetingCard key={meeting.id} meeting={meeting} onOpen={() => onOpen(meeting.id)} />
        ))
      )}
      {truncated && <p className="text-sm text-muted-foreground">{MEETING_LIST_TRUNCATED}</p>}
    </section>
  )
}

// 행사 회의 탭: 회의 메뉴와 같은 학생회 회의 읽기를 이 행사로 거른다. 읽기는 운영진 모두에게 열려 있다(DEC-104 ⑤).
export function EventMeetings({ councilId, eventId, onForbidden, referenceTime }: Props) {
  const clock = useNow()
  const read = usePolledRead<MeetingsResponse>(
    `/api/organizations/${councilId}/meetings?view=council&event=${eventId}`,
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
    },
  )
  if (read.state.kind === 'loading')
    return <StateMessage kind="loading">회의 불러오는 중…</StateMessage>
  if (read.state.kind === 'failed')
    return <MeetingReadFailure message={MEETING_LOAD_FAILED} onRetry={() => void read.reload()} />
  return (
    <EventMeetingList
      meetings={read.state.data.meetings}
      truncated={read.state.data.truncated}
      now={referenceTime ?? koreanOf(clock)}
      onOpen={id => openRecord('meetings', councilId, id)}
      onAll={() => navigate(menuPath('meetings', councilId))}
    />
  )
}
