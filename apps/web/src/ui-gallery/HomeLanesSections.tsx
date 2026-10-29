import type { HomeEventLane, HomeEventLanes } from '@vada/contracts'
import EventLanesCard from '@/home/EventLanesCard'
import { Section } from './GallerySection'
import { noop, today, Width } from './home-frame-samples'

// 회장단 홈 ② 행사(e6 확정 시안, 가로 시간 축). 폭은 시안의 977·571(1280 창 왼쪽 단)·358이다. 오늘은 갤러리의 오늘(10월 26일 (월)).

const lane = (
  id: string,
  name: string,
  color: HomeEventLane['event']['color'],
  extra: Partial<HomeEventLane>,
): HomeEventLane => ({
  event: { id, name, startsAt: null, endsAt: null, status: 'upcoming', color },
  milestone: null,
  registration: null,
  undecided: [],
  late: [],
  budget: null,
  ...extra,
})

const DAYS = { soon: 1, close: 2, start: 8, far: 18 } as const
const COUNT = { applied: 18, capacity: 40, full: 120 } as const
const OVER = 30000

export const mainLanes: HomeEventLanes = {
  events: [
    lane('e1', '가을 축제', 'sky', {
      event: {
        id: 'e1',
        name: '가을 축제',
        startsAt: '2026-10-25T10:00',
        endsAt: '2026-10-27T18:00',
        status: 'ongoing',
        color: 'sky',
      },
      milestone: { kind: 'event_end', date: '2026-10-27', days: DAYS.soon },
      late: [{ department: { id: 'd1', name: '기획부' }, overdue: 1 }],
      budget: { kind: 'over', amount: OVER },
    }),
    lane('e2', '진로 특강', 'violet', {
      milestone: { kind: 'registration_close', date: '2026-10-28', days: DAYS.close },
      registration: { formId: 'f1', count: COUNT.applied, capacity: COUNT.capacity, full: false },
      undecided: ['place'],
    }),
    lane('e3', '2026 소프트웨어융합대학 체육대회 및 학과 대항 리그', 'emerald', {
      milestone: { kind: 'registration_close', date: '2026-11-03', days: DAYS.start },
      registration: { formId: 'f2', count: COUNT.full, capacity: COUNT.full, full: true },
      budget: { kind: 'undecided' },
    }),
  ],
  total: 5,
}

const quietLanes: HomeEventLanes = {
  events: [
    lane('e4', '겨울 MT', 'lime', {
      milestone: { kind: 'event_start', date: '2026-11-13', days: DAYS.far },
    }),
    lane('e5', '신입생 환영회', 'indigo', {}),
  ],
  total: 2,
}

const emptyLanes: HomeEventLanes = { events: [], total: 0 }

const WIDTHS = [
  ['977px 칸(1280 창 본문)', 'w-244'],
  ['571px 칸(1280 창 왼쪽 단)', 'w-143'],
  ['358px 칸(휴대폰 구역)', 'w-90'],
] as const

export function HomeLanesSection() {
  const samples = [
    ['주(신호 많음)', mainLanes],
    ['평소(신호 없음, 창 밖·일정 미정)', quietLanes],
    ['0건', emptyLanes],
  ] as const
  return (
    <Section title="회장단 홈 ② 행사(e6)">
      {samples.flatMap(([name, lanes]) =>
        WIDTHS.map(([label, width]) => (
          <Width
            key={`${name}-${label}`}
            label={`${name} · ${label}`}
            className={`${width} shrink-0`}
          >
            <EventLanesCard
              lanes={lanes}
              today={today}
              onOpen={noop}
              onSignal={noop}
              onSeeAll={noop}
              onNewEvent={noop}
            />
          </Width>
        )),
      )}
    </Section>
  )
}
