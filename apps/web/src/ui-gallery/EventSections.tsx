import type { EventAction, EventDetail, EventSummary } from '@vada/contracts'
import { TabButton } from '@/components/ui/tab-button'
import { EventHeader } from '@/events/EventHeader'
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

const detail = (
  extra: Partial<EventDetail>,
  actions: EventAction[] = ['event.update'],
): EventDetail => ({
  ...event('h', {}),
  owner: { id: 'p1', name: '김기획', current: true },
  tasks: { open: 2, total: 5 },
  departments: [],
  health: { overdue: 0, unassigned: 0 },
  next: null,
  endedDays: null,
  history: [],
  approvals: [],
  actions,
  blockers: {},
  ...extra,
})

const tabs = (
  <div role="tablist" aria-label="행사 보기" className="flex border-b">
    {['개요', '업무', '재정', '인원 관리'].map((label, index) => (
      <TabButton key={label} aria-selected={index === 0}>
        {label}
      </TabButton>
    ))}
  </div>
)

const HEADERS: { key: string; event: EventDetail }[] = [
  {
    key: '기획 중',
    event: detail({ next: { kind: 'start', startsAt: '2026-10-24T14:00' } }),
  },
  {
    key: '기획 중, 날짜 미정',
    event: detail({
      status: 'tbd',
      startsAt: null,
      endsAt: null,
      place: null,
      tasks: { open: 0, total: 0 },
    }),
  },
  {
    key: '진행 중, 주의',
    event: detail({
      status: 'ongoing',
      departments: ['기획부', '재정부'],
      health: { overdue: 2, unassigned: 1 },
      next: { kind: 'task', dueDate: '2026-10-25', title: '현수막 철거' },
    }),
  },
  {
    key: '후속 정리 중, 정산 남음(회장단)',
    event: detail(
      {
        status: 'ended',
        endedDays: 9,
        departments: ['기획부'],
        health: { overdue: 0, unassigned: 1 },
        owner: { id: 'p2', name: '떠난 운영진 2', current: false },
        blockers: { 'event.complete': 'SETTLEMENT_PENDING' },
      },
      ['event.update'],
    ),
  },
  {
    key: '후속 정리 중, 완료 가능(회장단)',
    event: detail({ status: 'ended', endedDays: 3 }, ['event.update', 'event.complete']),
  },
  {
    key: '완료(회장단)',
    event: detail({ status: 'completed' }, ['event.cancel_completion']),
  },
  {
    key: '진행 중, 부원',
    event: detail({ status: 'ongoing', departments: ['기획부'] }, []),
  },
]

const headerHandlers = {
  councilId: 'c1',
  editing: null,
  onEdit: noop,
  onChanged: noop,
  onStale: noop,
  onLost: noop,
  onForbidden: noop,
}

// 행사 공통 머리(EVT-02): 상태마다 실제 화면 폭(본문 1024px)과 휴대폰 폭(390px)에서 본다.
export function EventHeaderSection() {
  return (
    <Section title="행사 머리">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        {HEADERS.map(({ key, event: sample }) => (
          <div key={key} className="flex flex-col gap-1">
            <p className="text-xs text-gray-400">{key}</p>
            <EventHeader event={sample} tabs={tabs} {...headerHandlers} />
          </div>
        ))}
      </div>
      <div className="flex w-97.5 max-w-full flex-col gap-8">
        {[HEADERS[2]!, HEADERS[3]!].map(({ key, event: sample }) => (
          <EventHeader
            key={key}
            event={{
              ...sample,
              name: `${longName} ${unbroken}`,
              departments: [longName, '재정부'],
            }}
            tabs={tabs}
            {...headerHandlers}
          />
        ))}
      </div>
    </Section>
  )
}
