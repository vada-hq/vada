import { CalendarDays, Clock, TriangleAlert } from 'lucide-react'
import type { AppQuery, HomeCouncil } from '@vada/contracts'
import { COUNCIL_TASK_LABEL } from '../tasks/task-view'
import { eventOrder, withoutIds } from './home-view'
import HomeEventRow from './HomeEventRow'
import HomeRow from './HomeRow'
import HomeSection, { HomeEmpty } from './HomeSection'
import { riskParts } from './risk-parts'
import TaskRow from './TaskRow'

// 회장단이 보는 막힌 곳은 학생회 전체 업무다.
const ALL = { view: 'all' } as const

type Props = {
  council: HomeCouncil
  today: string
  // 내 업무에 이미 보이는 업무. 지난 업무에서 뺀다.
  mineIds: Set<string>
  onOpenTask: (taskId: string) => void
  onOpenEvent: (eventId: string, tab?: 'money') => void
  // 업무 화면(전체 보기, 부서를 주면 그 부서만), 행사 화면으로 간다.
  onSeeTasks: (query?: AppQuery) => void
  onSeeEvents: () => void
}

// 학생회(회장단)의 행사: 막힌 행사부터, 날짜 칸과 업무 진행·막힌 수를 한 줄에.
export function CouncilEvents({
  council,
  today,
  onOpenEvent,
  onSeeEvents,
}: Pick<Props, 'council' | 'today' | 'onOpenEvent' | 'onSeeEvents'>) {
  return (
    <HomeSection
      id="home-events"
      icon={CalendarDays}
      title="행사"
      count={council.events.length > 0 ? council.events.length : undefined}
      onSeeAll={onSeeEvents}
    >
      {council.events.length === 0 && <HomeEmpty>진행할 행사 없음</HomeEmpty>}
      {eventOrder(council.events).map(card => (
        <HomeEventRow key={card.event.id} card={card} today={today} onOpen={onOpenEvent} />
      ))}
    </HomeSection>
  )
}

// 학생회(회장단)의 막힌 곳: 부서별 막힌 수와 내 것이 아닌 지난 업무. 있을 때만 보인다.
export function CouncilBlocked({
  council,
  today,
  mineIds,
  onOpenTask,
  onSeeTasks,
}: Omit<Props, 'onOpenEvent' | 'onSeeEvents'>) {
  const overdue = withoutIds(council.overdue, mineIds)
  return (
    <>
      {council.blocked.length > 0 && (
        <HomeSection
          id="home-blocked"
          icon={TriangleAlert}
          title="부서별 막힌 곳"
          onSeeAll={() => onSeeTasks(ALL)}
        >
          {council.blocked.map(item => (
            <HomeRow
              key={item.department?.id ?? 'none'}
              title={item.department?.name ?? COUNCIL_TASK_LABEL}
              side={riskParts(item)}
              onOpen={() =>
                onSeeTasks(item.department ? { ...ALL, dept: item.department.id } : ALL)
              }
            />
          ))}
        </HomeSection>
      )}
      {overdue.total > 0 && (
        <HomeSection
          id="home-overdue"
          icon={Clock}
          title="지난 업무"
          count={overdue.total}
          onSeeAll={() => onSeeTasks(ALL)}
        >
          {overdue.tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              onOpen={onOpenTask}
              showAssignee
              showDepartment
            />
          ))}
        </HomeSection>
      )}
    </>
  )
}
