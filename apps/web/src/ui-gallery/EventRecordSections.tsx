import { EventRecordView } from '@/records/EventRecordView'
import { RecordEventList } from '@/records/RecordEventList'
import {
  RECORD_COUNCIL,
  RECORD_NOW,
  recordItem,
  recordSample,
} from '@/records/test-support/record-samples'
import { Section } from './GallerySection'

const noop = () => {}

// 기록 메뉴(DEC-110). 와이어프레임 REC-01·REC-02와 나란히 보려고 본문 폭 그대로 그린다.
export function CompletedEventsSection() {
  return (
    <Section title="완료된 행사 (REC-01)">
      <div className="flex w-full min-w-0 flex-col gap-8">
        <RecordEventList
          now={RECORD_NOW}
          truncated={false}
          onOpen={noop}
          events={[
            recordItem(),
            recordItem({
              id: '0199d1a0-0000-7000-8000-0000000000e2',
              name: '2025학년도 종강 행사',
              startsAt: '2025-12-19T18:00',
              endsAt: '2025-12-19T21:00',
              departments: ['학술체육부'],
              owner: { id: '0199d1a0-0000-7000-8000-0000000000b3', name: '박체육', current: true },
              completedAt: '2026-01-07T06:00:00.000Z',
              chips: {
                attended: 320,
                applied: 356,
                budget: 2500000,
                actual: 2200000,
                executionRate: 88,
                tasksDone: 21,
              },
            }),
            recordItem({
              id: '0199d1a0-0000-7000-8000-0000000000e3',
              name: '신입생 환영 간담회',
              startsAt: null,
              endsAt: null,
              departments: [],
              owner: null,
              completedAt: '2025-03-28T06:00:00.000Z',
              chips: {
                attended: 0,
                applied: 0,
                budget: 0,
                actual: 0,
                executionRate: null,
                tasksDone: 0,
              },
            }),
          ]}
        />
        <RecordEventList now={RECORD_NOW} events={[]} truncated={false} onOpen={noop} />
      </div>
    </Section>
  )
}

export function EventRecordSection() {
  return (
    <Section title="행사 기록 상세 (REC-02)">
      <div className="w-full min-w-0">
        <EventRecordView councilId={RECORD_COUNCIL} record={recordSample()} now={RECORD_NOW} />
      </div>
    </Section>
  )
}
