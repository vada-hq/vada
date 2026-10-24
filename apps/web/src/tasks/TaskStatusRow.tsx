import { TASK_STATUSES, type TaskStatus } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STATUS_LABEL } from './task-view'

type Props = {
  status: TaskStatus
  // task.change_status가 있을 때만 바꿀 수 있다. 없으면 상태 배지만 보인다.
  canChange: boolean
  saving: boolean
  onChange: (status: TaskStatus) => void
}

// 상태 버튼 셋. 끌기 없이 어느 상태로든 바로 바꾼다(T1).
export function TaskStatusRow({ status, canChange, saving, onChange }: Props) {
  if (!canChange) return <Badge tone="info">{STATUS_LABEL[status]}</Badge>
  return (
    <div role="group" aria-label="상태" className="flex flex-wrap gap-2">
      {TASK_STATUSES.map(item => (
        <Button
          key={item}
          size="sm"
          variant={item === status ? 'default' : 'outline'}
          aria-pressed={item === status}
          disabled={saving}
          onClick={() => {
            if (item !== status) onChange(item)
          }}
        >
          {STATUS_LABEL[item]}
        </Button>
      ))}
    </div>
  )
}
