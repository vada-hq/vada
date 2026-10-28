import type { MeetingDetail } from '@vada/contracts'
import { Card } from '@/components/ui/card'
import { meetingTime } from './meeting-view'

export function MeetingConflict({ meeting }: { meeting: MeetingDetail }) {
  const fields = [
    ['회의명', meeting.title],
    ['회의 목적', meeting.purpose ?? '없음'],
    ['일시', meetingTime(meeting.heldAt, meeting.endsAt)],
    ['장소', meeting.place ?? '미정'],
    ['연결 행사', meeting.event?.name ?? '없음'],
    ['주관 부서', meeting.hostDepartment?.name ?? '학생회 전체'],
    ['참가자', meeting.attendees.map(person => person.name).join(', ')],
  ]
  return (
    <Card className="flex min-w-0 flex-col gap-4 border-yellow-200 bg-yellow-50 p-5">
      <h2 className="text-sm font-semibold">새로 불러온 회의</h2>
      <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 wrap-anywhere whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
