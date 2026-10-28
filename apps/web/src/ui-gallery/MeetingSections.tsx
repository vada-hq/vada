import { useState } from 'react'
import type { MeetingStatus } from '@vada/contracts'
import { MeetingList } from '@/meetings/MeetingList'
import { MeetingForm } from '@/meetings/MeetingForm'
import { MeetingDetail } from '@/meetings/MeetingDetail'
import { MeetingCancelDialog } from '@/meetings/MeetingCancelDialog'
import {
  MEETING_MEMBER,
  meetingOptions,
  meetingSample,
} from '@/meetings/test-support/meeting-samples'
import { Section } from './GallerySection'

const noop = () => {}
const readOptions = () => Promise.resolve(meetingOptions)
export function MeetingListSection() {
  const [status, setStatus] = useState<MeetingStatus | null>(null)
  return (
    <Section title="회의 목록">
      <div className="flex w-full min-w-0 flex-col gap-5 break-keep">
        <MeetingList
          referenceTime="2026-10-29T12:00"
          data={{
            meetings: [
              meetingSample(),
              meetingSample({
                id: '0199d1a0-0000-7000-8000-0000000000a2',
                title: '가을 축제 준비 회의',
                event: meetingOptions.events[0]!,
                hostDepartment: meetingOptions.departments[0]!,
              }),
              meetingSample({
                id: '0199d1a0-0000-7000-8000-0000000000a3',
                title: '부서별 현황 공유',
                status: 'in_progress',
                minutesStatus: 'draft',
                heldAt: '2026-10-29T11:30',
                endsAt: '2026-10-29T13:00',
              }),
              meetingSample({
                id: '0199d1a0-0000-7000-8000-0000000000a4',
                title: '10월 운영 회의',
                status: 'done',
                minutesStatus: 'confirmed',
                heldAt: '2026-10-22T14:00',
                endsAt: '2026-10-22T15:30',
              }),
              meetingSample({
                id: '0199d1a0-0000-7000-8000-0000000000a5',
                title: '홍보 준비 회의',
                status: 'cancelled',
                actions: [],
              }),
            ],
            truncated: false,
          }}
          status={status}
          onStatus={value => setStatus(value as MeetingStatus | null)}
          onOpen={noop}
          onCreate={noop}
        />
      </div>
    </Section>
  )
}
export function MeetingCreateSection() {
  const [saved, setSaved] = useState(false)
  return (
    <Section title="회의 만들기">
      <div className="flex w-full min-w-0 flex-col gap-5 break-keep">
        <MeetingForm
          memberId={MEETING_MEMBER}
          creatorName="김회장"
          initialOptions={meetingOptions}
          readOptions={readOptions}
          onSave={() => Promise.resolve(null)}
          onSaved={() => setSaved(true)}
          onClose={noop}
        />
        {saved && (
          <p role="status" className="text-sm">
            회의 생성 완료
          </p>
        )}
      </div>
    </Section>
  )
}
export function MeetingScheduledSection() {
  const [cancel, setCancel] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  return (
    <Section title="예정 회의">
      <div className="flex w-full min-w-0 flex-col gap-5 break-keep">
        <MeetingDetail
          meeting={
            cancelled
              ? meetingSample({
                  status: 'cancelled',
                  actions: [],
                  cancelReason: '일정 변경',
                  cancelledAt: '2026-10-29T02:20:00Z',
                })
              : meetingSample()
          }
          onEdit={noop}
          onCancel={() => setCancel(true)}
          onEvent={noop}
        />
        {cancel && (
          <MeetingCancelDialog
            onClose={() => setCancel(false)}
            onCancel={() => {
              setCancelled(true)
              return Promise.resolve(null)
            }}
          />
        )}
      </div>
    </Section>
  )
}
export function MeetingCancelledSection() {
  return (
    <Section title="취소 회의">
      <div className="flex w-full min-w-0 flex-col gap-5 break-keep">
        <MeetingDetail
          meeting={meetingSample({
            status: 'cancelled',
            actions: [],
            cancelReason: '행사 일정 변경으로 회의 취소',
            cancelledAt: '2026-10-29T02:20:00Z',
          })}
          onEdit={noop}
          onCancel={noop}
          onEvent={noop}
        />
      </div>
    </Section>
  )
}
