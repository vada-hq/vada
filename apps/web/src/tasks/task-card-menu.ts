import { recordPath, type TaskSummary } from '@vada/contracts'
import type { MenuAction } from '@/components/HistoryMenu'
import { copyText } from '@/lib/copy-text'

// 보드 카드 '⋯' 메뉴. 지금은 링크 복사만 잇는다. 지우기는 확인 창과 함께 2단계에서 잇고(DEC-73 지우기 권한은 task.remove),
// 복제는 서버가 만들기 권한을 판정한 동작을 줘야 해서 그 뒤다(notes/task-detail-redesign.md '남은 일').
export const cardMenuOf =
  (councilId: string) =>
  (task: TaskSummary): MenuAction[] => [
    {
      label: '링크 복사',
      onSelect: () => void copyText(`${location.origin}${recordPath('tasks', councilId, task.id)}`),
    },
  ]
