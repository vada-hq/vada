import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { assigneeLabel } from './task-view'
import type { UndoBar } from './useAssigneeUndo'

type Props = {
  bar: UndoBar | null
  dismiss: () => void
  undo: () => void | Promise<void>
}

// 담당자를 바꾼 뒤 화면 아래에 남는 띠. 초점을 옮기지 않고(낭독기는 role="status"로 알린다) 표 다음 Tab에 닿는다.
// 동작이 있는 알림이라 저절로 닫지 않는다(닫기나 다른 담당자 변경 때까지).
export function TaskUndoBar({ bar, dismiss, undo }: Props) {
  return (
    <div role="status" className="sticky bottom-4 z-10">
      {bar && (
        <div className="flex flex-col gap-1 rounded-sm border bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 wrap-anywhere">
              담당자 변경: {assigneeLabel(bar.assignee)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-blue-200 hover:bg-gray-800 hover:text-white"
              busy={bar.busy}
              onClick={() => void undo()}
            >
              되돌리기
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="닫기"
              className="text-gray-300 hover:bg-gray-800 hover:text-white"
              onClick={dismiss}
            >
              <X aria-hidden />
            </Button>
          </div>
          {bar.error && <p className="text-xs text-red-200 wrap-anywhere">{bar.error}</p>}
        </div>
      )}
    </div>
  )
}
