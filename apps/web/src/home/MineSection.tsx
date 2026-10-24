import { ListChecks } from 'lucide-react'
import type { HomeMine } from '@vada/contracts'
import { laterSummary, mineRows } from './home-view'
import HomeSection, { HomeEmpty } from './HomeSection'
import TaskRow from './TaskRow'

type Props = {
  mine: HomeMine
  today: string
  onOpenTask: (taskId: string) => void
  // 업무 화면 '내 업무'로 간다.
  onSeeAll: () => void
}

// 내 업무: 지남과 오늘만 줄로 두고 그 뒤는 수만 둔다. 모든 기간은 업무 화면이 맡는다.
export default function MineSection({ mine, today, onOpenTask, onSeeAll }: Props) {
  const rows = mineRows(mine)
  return (
    <HomeSection
      id="home-mine"
      icon={ListChecks}
      title="내 업무"
      count={rows.length > 0 ? rows.length : undefined}
      onSeeAll={onSeeAll}
      footer={laterSummary(mine)}
    >
      {rows.length === 0 && <HomeEmpty>오늘까지 할 업무 없음</HomeEmpty>}
      {rows.map(task => (
        <TaskRow key={task.id} task={task} today={today} onOpen={onOpenTask} />
      ))}
    </HomeSection>
  )
}
