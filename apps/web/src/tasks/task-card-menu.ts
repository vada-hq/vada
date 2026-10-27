import { recordPath, type TaskSummary } from '@vada/contracts'
import type { MenuAction } from '@/components/HistoryMenu'
import { copyText } from '@/lib/copy-text'

// 보드 카드 '⋯' 메뉴: 링크 복사, 지우기(서버가 task.remove를 줬을 때만, DEC-73·DEC-38).
// 상태는 끌어 놓기와 상세의 상태 단추로 바꾼다(끌기 없는 길은 상세, WCAG 2.5.7). 복제는 서버가 만들기 권한을 판정한 동작을 줘야 해서 뒤로 미룬다.
export const cardMenuOf =
  (councilId: string, onRemove: (taskId: string) => void) =>
  (task: TaskSummary): MenuAction[] => [
    {
      label: '링크 복사',
      onSelect: () => void copyText(`${location.origin}${recordPath('tasks', councilId, task.id)}`),
    },
    ...(task.actions.includes('task.remove')
      ? [{ label: '지우기', destructive: true, onSelect: () => onRemove(task.id) }]
      : []),
  ]
