import type { HomeMine, HomeTask, HomeTaskGroup } from '@vada/contracts'
import MineSection from '@/home/MineSection'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const task = (id: string, group: HomeTaskGroup, extra: Partial<HomeTask> = {}): HomeTask => ({
  id,
  title: '신입생 환영회 장소 예약',
  status: 'todo',
  dueDate: '2026-10-25',
  overdue: group === 'overdue',
  department: null,
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.status'],
  group,
  ...extra,
})

const full: HomeMine = {
  tasks: [
    task('a', 'overdue'),
    task('b', 'today', { event: { id: 'e1', name: '신입생 환영회' } }),
    task('c', 'soon', { title: `${unbroken} ${longName}` }),
  ],
  counts: { overdue: 12, today: 1, soon: 1, later: 4, noDue: 2 },
}
const empty: HomeMine = {
  tasks: [],
  counts: { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 },
}

const noop = () => {}

export function HomeSection() {
  return (
    <Section title="홈 · 내 업무">
      <div className="flex w-80 flex-col gap-3">
        <MineSection mine={full} onOpenTask={noop} onSeeAll={noop} />
        <MineSection mine={empty} onOpenTask={noop} onSeeAll={noop} />
      </div>
    </Section>
  )
}
