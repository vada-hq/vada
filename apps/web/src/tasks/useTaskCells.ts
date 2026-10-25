import { useCallback, useState } from 'react'
import { statusOf, type TaskResponse, type TaskSummary } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
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
import type { CellField } from './task-table-cells'

export type CellHandlers = {
  // 바꾼 뒤 목록과 수를 다시 읽게 한다.
  onDone: () => void
  // 403이면 학생회를 다시 읽어 권한을 새로 받는다.
  onForbidden: () => void
  // 404: 업무가 사라졌다. 화면 위에 이유를 보인다.
  onLost: (message: string) => void
}

type Sent = { ok: true; task: TaskSummary } | { ok: false; status: number; code: string }

const fieldPath = { status: '/status', assignee: '/assignee', department: '/department' } as const

// 행사는 제목·내용·마감을 지금 값 그대로 함께 보내야 한다(조각 2가 빼면 그대로로 넓히면 행사만 보낸다).
// 목록에는 내용이 없어 먼저 그 업무를 읽는다.
async function sendEvent(base: string, eventId: string | null): Promise<Sent> {
  const read = await getJson<TaskResponse>(base)
  if (!read.ok) return read
  const { title, body, dueDate } = read.data.task
  const result = await postJson<TaskResponse>(base, { title, body, dueDate, eventId })
  return result.ok ? { ok: true, task: result.data.task } : result
}

async function send(councilId: string, taskId: string, field: CellField, value: string | null) {
  const base = `${tasksBase(councilId)}/${encodeURIComponent(taskId)}`
  if (field === 'event') return sendEvent(base, value)
  const body =
    field === 'status'
      ? { status: value }
      : field === 'assignee'
        ? { assigneeId: value }
        : { departmentId: value }
  const result = await postJson<TaskResponse>(`${base}${fieldPath[field]}`, body)
  return result.ok ? ({ ok: true, task: result.data.task } satisfies Sent) : result
}

// 상태는 목록 줄의 [시작]과 같은 문구를, 그 밖은 상세 창과 같은 문구를 쓴다.
const problemOf = (field: CellField, code: string) =>
  field === 'status'
    ? (TASK_STATUS_ERRORS[code] ?? TASK_STATUS_FAILED)
    : (TASK_ERRORS[code] ?? TASK_STATUS_ERRORS[code] ?? TASK_FAILED)

const without = <T>(before: Readonly<Record<string, T>>, id: string) =>
  Object.fromEntries(Object.entries(before).filter(([key]) => key !== id))

// 표의 고르는 칸. 고르면 바로 보내고(미리 바꿔 보이지 않는다) 보내는 동안 그 칸만 막는다.
// 응답의 업무로 그 줄을 바꾼 뒤(patches) 목록을 다시 읽는다. 실패는 그 줄 아래 한 줄이다.
export function useTaskCells(councilId: string, handlers: CellHandlers) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [patches, setPatches] = useState<Readonly<Record<string, TaskSummary>>>({})
  const isActive = useActive()
  const { onDone, onForbidden, onLost } = handlers

  const finish = useCallback(
    (taskId: string, field: CellField, result: Sent) => {
      if (result.ok) {
        setPatches(before => ({ ...before, [taskId]: result.task }))
      } else if (result.status === statusOf('NOT_FOUND')) {
        onLost(TASK_LOST)
      } else {
        setErrors(before => ({ ...before, [taskId]: problemOf(field, result.code) }))
        if (result.status === statusOf('FORBIDDEN')) onForbidden()
      }
      onDone()
    },
    [onDone, onForbidden, onLost],
  )

  const save = useCallback(
    async (task: TaskSummary, field: CellField, raw: string) => {
      const key = `${task.id}|${field}`
      if (busy.has(key)) return
      setBusy(before => new Set(before).add(key))
      setErrors(before => without(before, task.id))
      const value = choiceId(raw)
      const result = await send(councilId, task.id, field, value)
      // 화면이 사라졌어도 바뀐 것은 옆 메뉴의 수에 반영해야 한다.
      if (!isActive()) return result.ok ? onDone() : undefined
      setBusy(before => {
        const next = new Set(before)
        next.delete(key)
        return next
      })
      finish(task.id, field, result)
    },
    [busy, councilId, finish, isActive, onDone],
  )

  const clearPatches = useCallback(
    () => setPatches(before => (Object.keys(before).length ? {} : before)),
    [],
  )
  return { busy, errors, patches, save, clearPatches }
}
export type TaskCells = ReturnType<typeof useTaskCells>
