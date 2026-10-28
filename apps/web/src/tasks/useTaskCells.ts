import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { statusOf, type TaskResponse, type TaskSummary } from '@vada/contracts'
import { postJson } from '@/lib/api'
import {
  TASK_ERRORS,
  TASK_FAILED,
  TASK_LOST,
  TASK_STATUS_ERRORS,
  TASK_STATUS_FAILED,
} from '@/lib/messages'
import { useActive } from '@/lib/use-active'
import { choiceId } from './task-form-options'
import { tasksBase } from './task-api'
import type { AssigneeChange } from './useAssigneeUndo'
import type { CellField } from './task-table-cells'
import { eventChangeOf, type TaskEventChange } from './useTaskEventUndo'

export type CellHandlers = {
  // 바꾼 뒤 목록과 수를 다시 읽게 한다.
  onDone: () => void
  // 403이면 학생회를 다시 읽어 권한을 새로 받는다.
  onForbidden: () => void
  // 404: 업무가 사라졌다. 화면 위에 이유를 보인다.
  onLost: (message: string) => void
  // 담당자를 바꿨다(되돌리기 띠). 이전 담당자 번호와 바뀐 담당자를 알린다.
  onAssigned?: ((change: AssigneeChange) => void) | undefined
  onEventChanged?: ((change: TaskEventChange) => void) | undefined
}

type Sent = { ok: true; task: TaskSummary } | { ok: false; status: number; code: string }

// 칸 하나는 그 키 하나만 보낸다(빼면 그대로). 제목·마감·행사는 업무 고치기 한 경로다.
export type SaveField = CellField | 'title' | 'dueDate'

const fieldPath = { status: '/status', assignee: '/assignee', department: '/department' } as const

function bodyOf(field: SaveField, value: string | null) {
  if (field === 'status') return { status: value }
  if (field === 'assignee') return { assigneeId: value }
  if (field === 'department') return { departmentId: value }
  if (field === 'event') return { eventId: value }
  return field === 'title' ? { title: value } : { dueDate: value }
}

async function send(councilId: string, taskId: string, field: SaveField, value: string | null) {
  const base = `${tasksBase(councilId)}/${encodeURIComponent(taskId)}`
  const path = field in fieldPath ? fieldPath[field as keyof typeof fieldPath] : ''
  const result = await postJson<TaskResponse>(`${base}${path}`, bodyOf(field, value))
  return result.ok ? ({ ok: true, task: result.data.task } satisfies Sent) : result
}

// 상태는 목록 줄의 [시작]과 같은 문구를, 그 밖은 상세 창과 같은 문구를 쓴다.
const problemOf = (field: SaveField, code: string) =>
  field === 'status'
    ? (TASK_STATUS_ERRORS[code] ?? TASK_STATUS_FAILED)
    : (TASK_ERRORS[code] ?? TASK_STATUS_ERRORS[code] ?? TASK_FAILED)

const without = <T>(before: Readonly<Record<string, T>>, id: string) =>
  Object.fromEntries(Object.entries(before).filter(([key]) => key !== id))

function noteChanges(
  before: TaskSummary,
  after: TaskSummary,
  field: SaveField,
  handlers: Pick<CellHandlers, 'onAssigned' | 'onEventChanged'>,
) {
  const change = field === 'event' && eventChangeOf(before, after)
  if (change) handlers.onEventChanged?.(change)
  if (field === 'assignee')
    handlers.onAssigned?.({
      taskId: before.id,
      previousId: before.assignee?.id ?? null,
      assignee: after.assignee,
    })
}

// 보낸 결과를 줄에 옮긴다. 성공은 응답의 업무로 줄을 바꾸고, 실패는 그 줄 아래 한 줄이다.
function useCellFinish(
  setPatches: Dispatch<SetStateAction<Readonly<Record<string, TaskSummary>>>>,
  setErrors: Dispatch<SetStateAction<Readonly<Record<string, string>>>>,
  { onDone, onForbidden, onLost, onAssigned, onEventChanged }: CellHandlers,
) {
  return useCallback(
    (task: TaskSummary, field: SaveField, result: Sent) => {
      if (result.ok) {
        setPatches(before => ({ ...before, [task.id]: result.task }))
        noteChanges(task, result.task, field, { onAssigned, onEventChanged })
      } else if (result.status === statusOf('NOT_FOUND')) {
        onLost(TASK_LOST)
      } else {
        setErrors(before => ({ ...before, [task.id]: problemOf(field, result.code) }))
        if (result.status === statusOf('FORBIDDEN')) onForbidden()
      }
      onDone()
    },
    [setPatches, setErrors, onDone, onForbidden, onLost, onAssigned, onEventChanged],
  )
}

// 표의 고르는 칸. 고르면 바로 보내고(미리 바꿔 보이지 않는다) 보내는 동안 그 칸만 막는다.
// 응답의 업무로 그 줄을 바꾼 뒤(patches) 목록을 다시 읽는다. 실패는 그 줄 아래 한 줄이다.
export function useTaskCells(councilId: string, handlers: CellHandlers) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [patches, setPatches] = useState<Readonly<Record<string, TaskSummary>>>({})
  const isActive = useActive()
  const { onDone } = handlers

  const finish = useCellFinish(setPatches, setErrors, handlers)

  // 보냈으면 true(고치던 글 칸이 닫힌다), 실패하거나 이미 보내는 중이면 false(고치기를 이어 간다).
  const save = useCallback(
    async (task: TaskSummary, field: SaveField, raw: string) => {
      const key = `${task.id}|${field}`
      if (busy.has(key)) return false
      setBusy(before => new Set(before).add(key))
      setErrors(before => without(before, task.id))
      const value = field === 'title' ? raw : choiceId(raw)
      const result = await send(councilId, task.id, field, value)
      // 화면이 사라졌어도 바뀐 것은 옆 메뉴의 수에 반영해야 한다.
      if (!isActive()) {
        if (result.ok) onDone()
        return result.ok
      }
      setBusy(before => {
        const next = new Set(before)
        next.delete(key)
        return next
      })
      finish(task, field, result)
      return result.ok
    },
    [busy, councilId, finish, isActive, onDone],
  )

  // 보내기 전에 화면이 잡은 문제(빈 제목, 100자 넘음)를 그 줄 아래 한 줄로 보인다.
  const fail = useCallback(
    (taskId: string, message: string) => setErrors(before => ({ ...before, [taskId]: message })),
    [],
  )
  const clearPatches = useCallback(
    () => setPatches(before => (Object.keys(before).length ? {} : before)),
    [],
  )
  return { busy, errors, patches, save, fail, clearPatches }
}
export type TaskCells = ReturnType<typeof useTaskCells>
