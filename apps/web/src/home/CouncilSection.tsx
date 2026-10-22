import { HOME_ENDED_LIMIT, type HomeCouncil } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { COUNCIL_TASK_LABEL, NO_ASSIGNEE_LABEL } from '../tasks/task-view'
import HomeEventCard from './HomeEventCard'
import TaskLines from './TaskLines'

type Props = {
  council: HomeCouncil
  onOpenTask: (taskId: string) => void
  onOpenEvent: (eventId: string, tab?: 'money') => void
  // 업무 화면, 행사 화면으로 간다.
  onSeeTasks: () => void
  onSeeEvents: () => void
}

function Events({ council, onOpenEvent, onSeeEvents }: Omit<Props, 'onOpenTask' | 'onSeeTasks'>) {
  const { events, truncated, endedTotal } = council
  if (events.length === 0)
    return (
      <div className="flex flex-col items-start gap-2">
        <StateMessage kind="empty">아직 행사가 없어요.</StateMessage>
        <Button variant="outline" size="sm" onClick={onSeeEvents}>
          새 행사
        </Button>
      </div>
    )
  const endedShown = events.filter(card => card.settlement).length
  return (
    <>
      <ul className="flex flex-col gap-2">
        {events.map(card => (
          <li key={card.event.id}>
            <HomeEventCard card={card} onOpen={onOpenEvent} />
          </li>
        ))}
      </ul>
      {endedTotal > endedShown && (
        <StateMessage kind="notice">
          {`끝난 행사 ${endedTotal}개 가운데 ${HOME_ENDED_LIMIT}개만 보여요.`}
        </StateMessage>
      )}
      {truncated && (
        <div className="flex items-center justify-between gap-2">
          <StateMessage kind="notice">행사가 많아서 일부만 보여요.</StateMessage>
          <Button variant="link" size="sm" className="px-0" onClick={onSeeEvents}>
            모두 보기
          </Button>
        </div>
      )}
    </>
  )
}

function Blocked({ blocked }: { blocked: HomeCouncil['blocked'] }) {
  if (blocked.length === 0) return null
  return (
    <div role="group" aria-label="부서별 막힌 곳" className="flex flex-col gap-1">
      <h4 className="px-2 text-xs font-semibold text-gray-500">부서별 막힌 곳</h4>
      <ul className="flex flex-col">
        {blocked.map(item => (
          <li
            key={item.department?.id ?? 'none'}
            className="flex flex-wrap gap-x-3 px-2 py-1 text-xs text-gray-500"
          >
            <span className="text-sm font-medium text-gray-900 wrap-anywhere">
              {item.department?.name ?? COUNCIL_TASK_LABEL}
            </span>
            <span>지남 {item.overdue}</span>
            <span>
              {NO_ASSIGNEE_LABEL} {item.unassigned}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// 학생회(회장단): 행사 카드, 부서별 막힌 곳, 학생회 전체의 지난 업무.
export default function CouncilSection({ council, onOpenTask, onSeeTasks, ...events }: Props) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-gray-900">학생회</h2>
      <Events council={council} {...events} />
      <Blocked blocked={council.blocked} />
      <TaskLines
        label="지난 업무"
        list={council.overdue}
        onOpenTask={onOpenTask}
        onSeeAll={onSeeTasks}
        showDepartment
      />
    </Card>
  )
}
