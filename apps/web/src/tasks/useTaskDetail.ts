import { useCallback, useEffect, useRef, useState } from 'react'
import type { TaskDetail, TaskResponse } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import { useLatest } from '@/lib/use-latest'
import { problemText, reportLost, type TaskDialogHandlers } from './task-requests'

// 오류가 보일 자리. 동작마다 그 동작 옆에 보인다.
export type TaskWhere = 'status' | 'department' | 'assignee' | 'edit' | 'delete'
export type TaskProblem = { where: TaskWhere; text: string }

// 업무 하나를 읽고 바꾼다. 바꾸는 요청은 한 번에 하나만 나가고, 응답으로 받은 업무가 화면의 값이 된다.
export function useTaskDetail(councilId: string, taskId: string, handlers: TaskDialogHandlers) {
  const base = `/api/organizations/${encodeURIComponent(councilId)}/tasks/${encodeURIComponent(taskId)}`
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<TaskProblem | null>(null)
  const sending = useRef(false)
  const latest = useLatest(handlers)

  useEffect(() => {
    const controller = new AbortController()
    setLoadFailed(false)
    void getJson<TaskResponse>(base, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) return setTask(result.data.task)
      if (!reportLost(latest.current, result.status)) setLoadFailed(true)
    })
    return () => controller.abort()
  }, [base, attempt, latest])

  // 성공하면 true다. 지우기는 본문 없는 204라 받은 업무가 없다.
  const send = useCallback(
    async (where: TaskWhere, path: string, body: unknown) => {
      if (sending.current) return false
      sending.current = true
      setSaving(true)
      setProblem(null)
      const result = await postJson<TaskResponse | undefined>(`${base}${path}`, body)
      sending.current = false
      setSaving(false)
      if (result.ok) {
        if (result.data) setTask(result.data.task)
        latest.current.onChanged()
        return true
      }
      if (!reportLost(latest.current, result.status))
        setProblem({ where, text: problemText(result.code) })
      return false
    },
    [base, latest],
  )

  return {
    task,
    loadFailed,
    saving,
    problem,
    send,
    retry: () => setAttempt(value => value + 1),
    clearProblem: () => setProblem(null),
  }
}
