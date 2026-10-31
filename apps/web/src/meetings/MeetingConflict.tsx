import type { MeetingDetail } from '@vada/contracts'
import { ConflictFacts } from '@/components/ConflictFacts'
import { meetingTime } from './meeting-view'

export function MeetingConflict({ meeting }: { meeting: MeetingDetail }) {
  return (
    <ConflictFacts
      title="새로 불러온 회의"
      fields={[
        ['회의명', meeting.title],
        ['회의 목적', meeting.purpose ?? '없음'],
        ['일시', meetingTime(meeting.heldAt, meeting.endsAt)],
        ['장소', meeting.place ?? '미정'],
        ['연결 행사', meeting.event?.name ?? '없음'],
        ['주관 부서', meeting.hostDepartment?.name ?? '학생회 전체'],
        ['참가자', meeting.attendees.map(person => person.name).join(', ')],
      ]}
    />
  )
}
