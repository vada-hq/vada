import { useCallback, useEffect, useState } from 'react'
import type { ChangeTaskStatusRequest, CreateTaskRequest, EventTasksResponse, MyTasksResponse, TaskDetail, TaskResponse, TaskSummary,
  UpdateTaskRequest } from '@vada/contracts'
import { taskFailure, taskMessage } from './task-view'

export type TaskResult = { ok: true; task: TaskDetail } | { ok: false; code: string | null; message: string }
export type DeleteResult = { ok: true; list: EventTasksResponse } | { ok: false; code: string | null; message: string }
const organizationBase = (organizationId: string) => `/api/organizations/${encodeURIComponent(organizationId)}`
export const tasksBase = (organizationId: string, eventId: string) => `${organizationBase(organizationId)}/events/${encodeURIComponent(eventId)}/tasks`
const one = (organizationId: string, eventId: string, taskId: string) => `${tasksBase(organizationId, eventId)}/${encodeURIComponent(taskId)}`
const isTask = (body: unknown): body is TaskResponse => typeof body === 'object' && body !== null
  && typeof (body as TaskResponse).task === 'object' && (body as TaskResponse).task !== null && Array.isArray((body as TaskResponse).task.history)
const isList = (body: unknown): body is EventTasksResponse => typeof body === 'object' && body !== null && Array.isArray((body as EventTasksResponse).tasks)
const isMine = (body: unknown): body is MyTasksResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as MyTasksResponse).open) && Array.isArray((body as MyTasksResponse).done)
const codeOf = (body: unknown) => {
  const code = (body as { error?: unknown } | null)?.error
  return typeof code === 'string' ? code : null
}

async function send(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<{ ok: boolean; body: unknown } | null> {
  try {
    const response = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: response.ok, body: await response.json().catch(() => null) }
  } catch {
    return null
  }
}
async function sendTask(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<TaskResult> {
  const result = await send(url, method, body)
  if (!result) return { ok: false, code: null, message: taskFailure }
  if (result.ok && isTask(result.body)) return { ok: true, task: result.body.task }
  return { ok: false, code: codeOf(result.body), message: taskMessage(codeOf(result.body)) }
}
export const createTask = (organizationId: string, eventId: string, input: CreateTaskRequest) => sendTask(tasksBase(organizationId, eventId), 'POST', input)
export const updateTask = (organizationId: string, eventId: string, taskId: string, input: UpdateTaskRequest) =>
  sendTask(one(organizationId, eventId, taskId), 'PATCH', input)
export const changeTaskStatus = (organizationId: string, eventId: string, taskId: string, input: ChangeTaskStatusRequest) =>
  sendTask(`${one(organizationId, eventId, taskId)}/status`, 'POST', input)
// 지우면 그 행사의 남은 업무 목록을 받는다.
export async function deleteTask(organizationId: string, eventId: string, taskId: string, version: number): Promise<DeleteResult> {
  const result = await send(`${one(organizationId, eventId, taskId)}/delete`, 'POST', { version })
  if (!result) return { ok: false, code: null, message: taskFailure }
  if (result.ok && isList(result.body)) return { ok: true, list: result.body }
  return { ok: false, code: codeOf(result.body), message: taskMessage(codeOf(result.body)) }
}
// 상세. 못 받으면 null이다.
export async function fetchTask(organizationId: string, eventId: string, taskId: string): Promise<TaskDetail | null> {
  try {
    const response = await fetch(one(organizationId, eventId, taskId), { credentials: 'same-origin', cache: 'no-store' })
    const body: unknown = await response.json()
    return response.ok && isTask(body) ? body.task : null
  } catch {
    return null
  }
}

function useLoad<T>(url: string, enabled: boolean, valid: (body: unknown) => body is T) {
  const [data, setData] = useState<T | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !valid(body)) throw new Error('Tasks lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, enabled, attempt, valid])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  return { data, setData, loadError, refresh }
}

// 행사 업무 탭을 열 때 불러온다. 바꾼 업무는 받은 응답으로 목록에서 바꾼다.
export function useEventTasks(organizationId: string, eventId: string, enabled: boolean) {
  const { data, setData, loadError, refresh } = useLoad(tasksBase(organizationId, eventId), enabled, isList)
  const replace = useCallback((task: TaskSummary) => setData(current => {
    if (!current) return current
    const exists = current.tasks.some(item => item.id === task.id)
    return { ...current, tasks: exists ? current.tasks.map(item => item.id === task.id ? task : item) : [...current.tasks, task] }
  }), [setData])
  return { data, loadError, refresh, replace, setList: setData }
}
export type EventTasks = ReturnType<typeof useEventTasks>

// 학생회를 열면 불러온다. 옆 메뉴의 남은 수와 내 업무 화면이 같이 쓴다.
export function useMyTasks(organizationId: string) {
  const { data, loadError, refresh } = useLoad(`${organizationBase(organizationId)}/my-tasks`, true, isMine)
  return { data, loadError, refresh }
}
export type MyTasks = ReturnType<typeof useMyTasks>
