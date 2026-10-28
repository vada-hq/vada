import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import {
  koreanOf,
  MEETING_LIST_LIMIT,
  MEETING_STATUSES,
  type MeetingsResponse,
  type MeetingStatus,
  type MeetingSummary,
} from '@vada/contracts'
import PageActions from '@/components/PageActions'
import PageHeading from '@/components/PageHeading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useNow } from '@/lib/use-now'
import { MEETING_STATUS, MINUTES_STATUS } from './meeting-text'
import { meetingGroups, meetingTime, type MeetingGroup } from './meeting-view'

function MeetingCard({
  meeting,
  onOpen,
}: {
  meeting: MeetingSummary
  onOpen: (id: string) => void
}) {
  const status = MEETING_STATUS[meeting.status]
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-5">
      <div className="flex min-w-0 items-start gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <h3 className="min-w-0 wrap-anywhere text-base font-semibold">{meeting.title}</h3>
      </div>
      <p className="text-sm tabular-nums">{meetingTime(meeting.heldAt, meeting.endsAt)}</p>
      <p className="wrap-anywhere text-sm text-muted-foreground">{meeting.place ?? '장소 미정'}</p>
      {meeting.hostDepartment && (
        <p className="wrap-anywhere text-sm text-muted-foreground">
          주관 {meeting.hostDepartment.name}
        </p>
      )}
      <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div>
          <dt>참가자</dt>
          <dd className="mt-1 text-right tabular-nums">{meeting.attendeeCount}명</dd>
        </div>
        <div>
          <dt>안건</dt>
          <dd className="mt-1 text-right tabular-nums">{meeting.agendaCount}건</dd>
        </div>
        <div>
          <dt>회의록</dt>
          <dd className="mt-1 text-right">
            {meeting.status === 'cancelled' ? '취소' : MINUTES_STATUS[meeting.minutesStatus]}
          </dd>
        </div>
      </dl>
      <Button
        variant="outline"
        touch
        className="mt-auto self-end"
        onClick={() => onOpen(meeting.id)}
      >
        {meeting.status === 'cancelled' ? '취소 내용 보기' : '상세 보기'}
      </Button>
    </Card>
  )
}
function Group({ group, onOpen }: { group: MeetingGroup; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <section className="min-w-0" aria-label={group.name}>
      <Button
        variant="ghost"
        touch
        className="mb-3 w-full min-w-0 justify-start px-0 text-foreground"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon aria-hidden className="size-4" />
        <span className="min-w-0 wrap-anywhere text-left text-base font-semibold whitespace-normal">
          {group.name}
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          총 {group.meetings.length}건
        </span>
      </Button>
      {open && (
        <>
          {group.nearest && (
            <p className="mb-3 text-xs text-muted-foreground tabular-nums">
              가장 가까운 회의: {meetingTime(group.nearest.heldAt, null)}
            </p>
          )}
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {group.meetings.map(meeting => (
              <MeetingCard key={meeting.id} meeting={meeting} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
type Props = {
  data: MeetingsResponse
  status: MeetingStatus | null
  onStatus: (status: string | null) => void
  onOpen: (id: string) => void
  onCreate?: (() => void) | undefined
  referenceTime?: string
}
export function MeetingList({ data, status, onStatus, onOpen, onCreate, referenceTime }: Props) {
  const [search, setSearch] = useState('')
  const clock = useNow()
  const now = referenceTime ?? koreanOf(clock)
  const groups = meetingGroups(data.meetings, search, status, now)
  return (
    <>
      <PageHeading trail={{ title: '회의', crumbs: [] }}>
        <h1 className="text-xl font-semibold">회의</h1>
      </PageHeading>
      {onCreate && (
        <PageActions>
          <Button touch onClick={onCreate}>
            <Plus aria-hidden />새 회의
          </Button>
        </PageActions>
      )}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
        <Field label="회의 검색" className="min-w-0 flex-1">
          <Input
            type="search"
            className="max-sm:min-h-11"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </Field>
        <Field label="상태">
          <NativeSelect
            className="max-sm:min-h-11"
            value={status ?? ''}
            onChange={event => onStatus(event.target.value || null)}
          >
            <option value="">전체</option>
            {MEETING_STATUSES.map(value => (
              <option key={value} value={value}>
                {MEETING_STATUS[value].label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {groups.map(group => (
        <Group key={group.id} group={group} onOpen={onOpen} />
      ))}
      {groups.length === 0 && (
        <Card className="flex flex-col items-start gap-4 p-6">
          <p className="text-sm text-muted-foreground">
            {search.trim() || status ? '맞는 회의 없음' : '회의 없음'}
          </p>
          {!data.meetings.length && onCreate && (
            <Button touch onClick={onCreate}>
              새 회의
            </Button>
          )}
        </Card>
      )}
      {data.truncated && (
        <p className="text-sm text-muted-foreground">최근 {MEETING_LIST_LIMIT}건만 보여요</p>
      )}
    </>
  )
}
