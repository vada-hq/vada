import type { EventStatus, EventSummary, HomeCouncil } from '@vada/contracts'
import { CouncilEvents } from '@/home/CouncilSection'
import WeekEventsSection from '@/home/WeekEventsSection'
import { Section } from './GallerySection'
import { Width } from './home-frame-samples'
import { longName } from './sample-text'

const noop = () => {}
// 남은 날(D-3, 내일)이 실제처럼 보이는 기준일
const today = '2026-10-23'
const noTasks = { tasks: [], total: 0 }

// 행사 줄의 상태 칩(DEC-93, 기능 027 조각 2): 기획 중(예정 D-3, 날짜 미정), 진행 중, 후속 정리 중. 남은 날은 날짜 쪽에 있다.
const statusEvent = (name: string, status: EventStatus, startsAt: string | null): EventSummary => ({
  id: name,
  name,
  startsAt,
  endsAt: null,
  place: status === 'ongoing' ? '대강당' : null,
  owner: { id: 'p1', name: '김회장', current: true },
  status,
})
const statusCouncil: HomeCouncil = {
  truncated: false,
  endedTotal: 1,
  blocked: [],
  overdue: noTasks,
  unassignedMembers: 0,
  events: [
    {
      event: statusEvent('가을 축제', 'upcoming', '2026-10-26T18:00'),
      tasks: { done: 2, total: 5, overdue: 0, unassigned: 0 },
    },
    {
      event: statusEvent(longName, 'tbd', null),
      tasks: { done: 0, total: 0, overdue: 0, unassigned: 0 },
    },
    {
      event: statusEvent('체육대회', 'ongoing', '2026-10-23T10:00'),
      tasks: { done: 6, total: 8, overdue: 1, unassigned: 0 },
    },
    {
      event: statusEvent('신입생 환영회', 'ended', '2026-10-20T10:00'),
      tasks: { done: 4, total: 4, overdue: 0, unassigned: 0 },
      settlement: { remaining: 2, settled: false },
    },
  ],
}
const statusWeek = [
  statusEvent('체육대회', 'ongoing', '2026-10-23T10:00'),
  statusEvent('동아리 박람회', 'upcoming', '2026-10-24T13:00'),
  statusEvent('가을 축제', 'upcoming', '2026-10-26T18:00'),
]

// 넓은 화면은 홈의 두 단 자리(회장단 '행사'는 넓은 단, 부장 '이번 주 행사'는 좁은 단), 휴대폰은 한 단이다.
function StatusRows({ wide }: { wide: boolean }) {
  return (
    <div className={wide ? 'grid grid-cols-3 gap-6' : 'flex flex-col gap-6'}>
      <div className={wide ? 'col-span-2 flex min-w-0 flex-col' : 'flex min-w-0 flex-col'}>
        <CouncilEvents
          council={statusCouncil}
          today={today}
          onOpenEvent={noop}
          onSeeEvents={noop}
        />
      </div>
      <div className="flex min-w-0 flex-col">
        <WeekEventsSection
          events={statusWeek}
          today={today}
          noOpenEvents={false}
          onOpenEvent={noop}
          onSeeAll={noop}
        />
      </div>
    </div>
  )
}

export function HomeEventStatusSection() {
  return (
    <Section title="홈 · 행사 줄 상태 칩">
      <Width label="1280px 창(회장단 행사, 부장 이번 주 행사)" className="w-248 shrink-0">
        <StatusRows wide />
      </Width>
      <Width label="420px 창" className="w-97 shrink-0">
        <StatusRows wide={false} />
      </Width>
    </Section>
  )
}
