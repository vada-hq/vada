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

export const detail = (
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

export const tabs = (
  <div role="tablist" aria-label="행사 보기" className="flex border-b">
    {['메시지', '개요', '업무', '재정', '인원 관리'].map(label => (
      <TabButton key={label} aria-selected={label === '개요'}>
        {label}
      </TabButton>
    ))}
  </div>
)

const ended = { status: 'ended' as const, departments: ['기획부'] }

// 찍을 때 잘리지 않게 행동 자리가 다른 견본(완료 가능, 정산 남음, 완료, 부원)을 앞에 둔다.
// '완료 가능'의 [완료]를 누르면 완료 확인 창(EVT-02E)이 열린다(확인을 누르지 않으면 보내지 않는다).
const HEADERS: { key: string; event: EventDetail }[] = [
  {
    key: '후속 정리 중, 완료 가능(회장단): [완료]를 누르면 확인 창',
    event: detail({ ...ended, endedDays: 3 }, ['event.update', 'event.complete']),
  },
  {
    key: '후속 정리 중, 정산 남음(회장단)',
    event: detail(
      {
        ...ended,
        endedDays: 9,
        health: { overdue: 0, unassigned: 1 },
        owner: { id: 'p2', name: '떠난 운영진 2', current: false },
        blockers: { 'event.complete': 'SETTLEMENT_PENDING' },
      },
      ['event.update'],
    ),
  },
  {
    key: '완료(회장단)',
    event: detail({ status: 'completed', departments: ['기획부'] }, ['event.cancel_completion']),
  },
  {
    key: '진행 중, 부원(버튼 없음)',
    event: detail({ status: 'ongoing', departments: ['기획부'] }, []),
  },
  {
    key: '진행 중, 주의, 부서 둘',
    event: detail({
      status: 'ongoing',
      departments: ['기획부', '재정부'],
      health: { overdue: 2, unassigned: 1 },
      next: { kind: 'task', dueDate: '2026-10-25', title: '현수막 철거' },
    }),
  },
  {
    key: '기획 중(회장단): 끝나기 전이라 막힌 까닭 없음',
    event: detail({
      next: { kind: 'start', startsAt: '2026-10-24T14:00' },
      blockers: { 'event.complete': 'EVENT_NOT_ENDED' },
    }),
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
]

// 휴대폰 폭은 행동 자리가 다른 앞의 넷만, 긴 이름으로 본다.
const MOBILE_SAMPLES = 4

export const headerHandlers = {
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
            <p className="text-xs text-gray-500">{key}</p>
            <EventHeader event={sample} tabs={tabs} tabLabel="개요" {...headerHandlers} />
          </div>
        ))}
      </div>
      <div className="flex w-97.5 max-w-full flex-col gap-8">
        {HEADERS.slice(0, MOBILE_SAMPLES).map(({ key, event: sample }) => (
          <EventHeader
            key={key}
            event={{
              ...sample,
              name: `${longName} ${unbroken}`,
              departments: [longName, '재정부'],
            }}
            tabs={tabs}
            tabLabel="개요"
            {...headerHandlers}
          />
        ))}
      </div>
    </Section>
  )
}
