import { useState, type Dispatch, type SetStateAction } from 'react'
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
  type TaskCreateValues,
} from './task-fields'
import { useTaskCreate } from './useTaskCreate'

type Setup = {
  context: QuickAddContext
  options: TaskCreateOptionsResponse
  initial?: TaskCreateInitial | undefined
  origin?: { agendaItemId: string } | undefined
  onClose: () => void
  onCreated: () => void
  onOpenTask: (id: string) => void
  onForbidden: () => void
}

function departmentChange(props: Setup, setValues: Dispatch<SetStateAction<TaskCreateValues>>) {
  const { options, context } = props
  return (departmentId: string | null) => {
    const department = options.departments.find(item => item.id === departmentId)
    if (!department) return
    setValues(before => ({
      ...before,
      departmentId,
      assigneeId: selectAssignee(department.assignees, before.assigneeId, context.view.me.memberId),
      eventId: allowedCreateEvent(options, departmentId, before.eventId, context.eventId),
    }))
  }
}

function useCreateClose(dirty: boolean, props: Setup) {
  const [discarding, setDiscarding] = useState(false)
  const settle = useUnsavedInput(dirty)
  return {
    settle,
    discarding,
    keepWriting: () => setDiscarding(false),
    discard: () => {
      settle()
      props.onClose()
    },
    close: (busy: boolean) => {
      if (busy) return
      if (!props.origin) return askLeave(props.onClose)
      // 회의록의 실패한 초안은 그대로 두므로 전역 나가기 확인으로 지킴을 풀지 않는다.
      if (!dirty) props.onClose()
      else setDiscarding(true)
    },
  }
}

// 미리 채운 값은 버리는 입력으로 세지 않는다. 성공한 뒤에는 지킴을 먼저 풀고 패널을 연다.
export function useTaskCreateForm(props: Setup) {
  const { context, options } = props
  const [initial] = useState(() => initialCreateValues(options, context, props.initial ?? {}))
  const [values, setValues] = useState(initial)
  const leave = useCreateClose(!sameJson(values, initial), props)
  // 선택지는 15초마다 다시 읽는다. 빠진 부서·담당자·행사가 화면과 요청에 남지 않게 늘 지금 선택지로 맞춘 값을 쓴다.
  const current = initialCreateValues(options, context, values)
  const request = {
    ...createRequest(current, current.departmentId, current.assigneeId, current.eventId),
    ...props.origin,
  }
  const create = useTaskCreate(context.view.council.id, request, {
    onForbidden: props.onForbidden,
    onCreated: task => {
      leave.settle()
      props.onClose()
      props.onCreated()
      props.onOpenTask(task.id)
    },
  })
  const check = useFormCheck(() =>
    withContract(taskErrors(current), create.parsed, TASK_CONTRACT_MESSAGES),
  )
  return {
    values: current,
    setValues,
    onDepartment: departmentChange(props, setValues),
    ...check,
    busy: create.busy,
    problem: create.problem,
    ...leave,
    submit: () => {
      if (check.attempt()) void create.submit()
    },
    close: () => leave.close(create.busy),
  }
}
