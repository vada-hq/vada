import type { EventSummary } from '@vada/contracts'
import EventRow from '@/events/EventRow'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const event = (id: string, extra: Partial<EventSummary>): EventSummary => ({
  id,
  name: '신입생 환영회',
  startsAt: '2026-10-24T14:00',
  endsAt: '2026-10-24T18:00',
  place: '대강당',
  owner: { id: 'p1', name: '김새내', current: true },
  status: 'upcoming',
  ...extra,
})

const noop = () => {}

export function EventSection() {
  return (
    <Section title="행사 목록 줄·상태 배지">
      <div className="flex w-160 flex-col divide-y rounded-lg border bg-white">
        <EventRow event={event('1', {})} onOpen={noop} />
        <EventRow event={event('2', { status: 'ongoing' })} onOpen={noop} />
        <EventRow
          event={event('3', {
            status: 'tbd',
            startsAt: null,
            endsAt: null,
            owner: null,
          })}
          onOpen={noop}
        />
        <EventRow
          event={event('4', {
            status: 'ended',
            endsAt: '2026-10-25T02:00',
            owner: { id: 'p2', name: '이떠남', current: false },
          })}
          onOpen={noop}
        />
        <EventRow
          event={event('5', {
            name: `${unbroken} ${longName}`,
            owner: { id: 'p3', name: longName, current: true },
          })}
          onOpen={noop}
        />
      </div>
    </Section>
  )
}
