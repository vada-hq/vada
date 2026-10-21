import { useState } from 'react'
import { UpdateTaskSchema, type TaskDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { fieldsOf, fieldsRequest } from './task-fields'
import { TaskFields } from './TaskFields'

type Props = {
  task: TaskDetail
  saving: boolean
  problem: string | undefined
  // 성공하면 true
  onSave: (request: ReturnType<typeof fieldsRequest>) => Promise<boolean>
  onCancel: () => void
}

// 제목, 내용, 마감 고치기. 저장 버튼은 계약의 safeParse로 켠다.
export function TaskEditForm({ task, saving, problem, onSave, onCancel }: Props) {
  const [values, setValues] = useState(fieldsOf(task))
  const request = fieldsRequest(values)
  const valid = UpdateTaskSchema.safeParse(request).success
  return (
    <form
      aria-label="업무 고치기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (valid && !saving) void onSave(request)
      }}
    >
      <TaskFields values={values} disabled={saving} onChange={setValues} />
      {problem && <StateMessage kind="error">{problem}</StateMessage>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={!valid || saving}>
          저장
        </Button>
      </div>
    </form>
  )
}
