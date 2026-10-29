import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { TASK_SORT_LABEL, TASK_SORTS, type TaskSort } from './task-sort'

type Props = { value: TaskSort; onChange: (sort: TaskSort) => void }

const sortOf = (value: string) => TASK_SORTS.find(sort => sort === value)

// 업무 보드·표의 정렬 고르기. 거르기 칩과 같은 줄에 두어 이름표를 옆에 짧게 붙인다.
export function TaskSortSelect({ value, onChange }: Props) {
  const id = useId()
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        정렬
      </Label>
      <NativeSelect
        id={id}
        value={value}
        className="h-8 w-auto text-sm max-sm:min-h-11"
        onChange={event => {
          const next = sortOf(event.target.value)
          if (next) onChange(next)
        }}
      >
        {TASK_SORTS.map(sort => (
          <option key={sort} value={sort}>
            {TASK_SORT_LABEL[sort]}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
