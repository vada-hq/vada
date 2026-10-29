import { EventMeetingList } from '@/meetings/EventMeetings'
import { MeetingTabs } from '@/meetings/MeetingTabs'
import { MyMeetingList } from '@/meetings/MyMeetingList'
import { meetingOptions, meetingSample } from '@/meetings/test-support/meeting-samples'
import { Section } from './GallerySection'

const noop = () => {}
// 내 회의 탭(MEET-MY-01)과 행사 회의 탭(EVT-MEET-01). 둘 다 서버가 고른 회의를 읽기만 한다.
const eventMeetings = [
  meetingSample({
    id: '0199d1a0-0000-7000-8000-0000000000a6',
    title: '축제 운영 점검 회의',
    status: 'in_progress',
    heldAt: '2026-10-29T11:00',
    endsAt: '2026-10-29T13:00',
    event: meetingOptions.events[0]!,
  }),
  meetingSample({
    id: '0199d1a0-0000-7000-8000-0000000000a7',
    title: '부스 배치 기획회의',
    status: 'wrapping_up',
    heldAt: '2026-10-27T16:00',
    endsAt: '2026-10-27T17:00',
    event: meetingOptions.events[0]!,
  }),
  meetingSample({ event: meetingOptions.events[0]!, title: '안전 관리 최종 회의' }),
]
export function MyMeetingSection() {
  return (
    <Section title="내 회의">
      <div className="flex w-full min-w-0 flex-col gap-5 break-keep">
        <MeetingTabs tab="mine" onTab={noop} />
        <MyMeetingList
          truncated={false}
          meetings={[
            ...eventMeetings,
            meetingSample({
              id: '0199d1a0-0000-7000-8000-0000000000a8',
              title: '학생회 정기 운영회의',
              heldAt: '2026-11-05T18:00',
              endsAt: '2026-11-05T19:00',
            }),
          ]}
          onOpen={noop}
          onAll={noop}
        />
        <MyMeetingList meetings={[]} truncated={false} onOpen={noop} onAll={noop} />
      </div>
    </Section>
  )
}
export function EventMeetingsSection() {
  return (
    <Section title="행사 회의 탭">
      <div className="flex w-full min-w-0 flex-col gap-5 break-keep">
        <EventMeetingList
          truncated={false}
          meetings={[
            ...eventMeetings,
            meetingSample({
              id: '0199d1a0-0000-7000-8000-0000000000a9',
              title: '참가자 모집 결과 검토',
              status: 'done',
              minutesStatus: 'confirmed',
              heldAt: '2026-10-12T18:00',
              endsAt: '2026-10-12T19:00',
              event: meetingOptions.events[0]!,
            }),
          ]}
          now="2026-10-29T12:00"
          onOpen={noop}
          onAll={noop}
        />
        <EventMeetingList
          meetings={[]}
          truncated={false}
          now="2026-10-29T12:00"
          onOpen={noop}
          onAll={noop}
        />
      </div>
    </Section>
  )
}
