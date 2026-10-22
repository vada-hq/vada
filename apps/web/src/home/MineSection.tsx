import { HOME_TASK_GROUPS, type HomeMine, type HomeTask, type HomeTaskGroup } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GROUP_LABEL, mineIsEmpty } from './home-view'
import TaskRow from './TaskRow'

type Props = {
  mine: HomeMine
  onOpenTask: (taskId: string) => void
  // 업무 화면 '내 업무'로 간다.
  onSeeAll: () => void
}

function Group({
  group,
  count,
  tasks,
  onOpenTask,
  onSeeAll,
}: {
  group: HomeTaskGroup
  count: number
  tasks: HomeTask[]
} & Pick<Props, 'onOpenTask' | 'onSeeAll'>) {
  return (
    <div
      role="group"
      aria-label={`${GROUP_LABEL[group]} ${count}개`}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center justify-between gap-2 px-2">
        <h3 className="text-xs font-semibold text-gray-500">
          {GROUP_LABEL[group]} {count}
        </h3>
        <Button variant="link" size="sm" className="px-0" onClick={onSeeAll}>
          모두 보기
        </Button>
      </div>
      <ul className="flex flex-col">
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onOpen={onOpenTask} />
        ))}
      </ul>
    </div>
  )
}

// 내 업무: 지남·오늘·7일 안 묶음마다 수와 줄, 그 뒤와 마감 없는 업무는 수만. 줄은 업무 화면의 그 업무로 간다.
export default function MineSection({ mine, onOpenTask, onSeeAll }: Props) {
  const { counts } = mine
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-gray-900">내 업무</h2>
      {mineIsEmpty(mine) && <StateMessage kind="empty">지금 할 업무가 없어요.</StateMessage>}
      {HOME_TASK_GROUPS.filter(group => counts[group] > 0).map(group => (
        <Group
          key={group}
          group={group}
          count={counts[group]}
          tasks={mine.tasks.filter(task => task.group === group)}
          onOpenTask={onOpenTask}
          onSeeAll={onSeeAll}
        />
      ))}
      {counts.later > 0 && <p className="px-2 text-xs text-gray-500">그 뒤 {counts.later}개</p>}
      {counts.noDue > 0 && <p className="px-2 text-xs text-gray-500">마감 없음 {counts.noDue}개</p>}
    </Card>
  )
}
