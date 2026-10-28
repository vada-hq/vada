import { useState } from 'react'
import type { TaskCreateOptionsResponse } from '@vada/contracts'
import { sameJson } from '@/lib/same-json'
import { askLeave, useUnsavedInput } from '@/lib/leave-guard'
import { useFormCheck, withContract } from '@/lib/use-form-check'
import { selectAssignee, type QuickAddContext } from './task-defaults'
import {
  allowedCreateEvent,
  createRequest,
  initialCreateValues,
  TASK_CONTRACT_MESSAGES,
  taskErrors,
  type TaskCreateInitial,
} from './task-fields'
import { useTaskCreate } from './useTaskCreate'

type Setup = {
  context: QuickAddContext
  options: TaskCreateOptionsResponse
  initial?: TaskCreateInitial | undefined
  onClose: () => void
  onCreated: () => void
  onOpenTask: (id: string) => void
  onForbidden: () => void
}

// 미리 채운 값은 버리는 입력으로 세지 않는다. 성공한 뒤에는 지킴을 먼저 풀고 패널을 연다.
export function useTaskCreateForm(props: Setup) {
  const { context, options } = props
  const [initial] = useState(() => initialCreateValues(options, context, props.initial ?? {}))
  const [values, setValues] = useState(initial)
  const settle = useUnsavedInput(!sameJson(values, initial))
  const request = createRequest(values, values.departmentId, values.assigneeId, values.eventId)
  const create = useTaskCreate(context.view.council.id, request, {
    onForbidden: props.onForbidden,
    onCreated: task => {
      settle()
      props.onClose()
      props.onCreated()
      props.onOpenTask(task.id)
    },
  })
  const check = useFormCheck(() =>
    withContract(taskErrors(values), create.parsed, TASK_CONTRACT_MESSAGES),
  )
  const onDepartment = (departmentId: string | null) => {
    const department = options.departments.find(item => item.id === departmentId)
    if (!department) return
    setValues(before => ({
      ...before,
      departmentId,
      assigneeId: selectAssignee(department.assignees, before.assigneeId, context.view.me.memberId),
      eventId: allowedCreateEvent(options, departmentId, before.eventId, context.eventId),
    }))
  }
  return {
    values,
    setValues,
    onDepartment,
    ...check,
    busy: create.busy,
    problem: create.problem,
    submit: () => {
      if (check.attempt()) void create.submit()
    },
    close: () => {
      if (!create.busy) askLeave(props.onClose)
    },
  }
}
