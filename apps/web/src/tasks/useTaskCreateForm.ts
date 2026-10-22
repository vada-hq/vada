import { useState } from 'react'
import type { CouncilView, EventSummary, TeamResponse } from '@vada/contracts'
import { createRequest, emptyFields } from './task-fields'
import {
  assigneeChoices,
  defaultDepartmentId,
  departmentChoices,
  eventChoices,
  keepAssignee,
  ownsEvent,
} from './task-form-options'

// 업무 만들기 폼의 칸과 선택지. 행사를 고르면 그 행사의 책임자인 나는 모든 부서와 모든 운영진을 고를 수 있어,
// 부서·담당자 선택지가 따라 바뀐다. 고르던 값이 새 선택지에 없으면 첫 선택지로 돌린다.
export function useTaskCreateForm(
  view: CouncilView,
  team: TeamResponse,
  events: EventSummary[],
  fixedEventId: string | undefined,
) {
  const [fields, setFields] = useState(emptyFields)
  const [eventId, setEventId] = useState(fixedEventId ?? null)
  const owns = ownsEvent(view, events, eventId)
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId(view, owns))
  const [assigneeId, setAssigneeId] = useState(() =>
    keepAssignee(assigneeChoices(view, team, departmentId, owns), null),
  )
  const departments = departmentChoices(view, team, owns)
  const assignees = assigneeChoices(view, team, departmentId, owns)
  return {
    fields,
    setFields,
    eventId,
    departmentId,
    assigneeId,
    setAssigneeId,
    events: eventChoices(events, null),
    departments,
    assignees,
    request: createRequest(fields, departmentId, assigneeId, eventId),
    pickEvent: (next: string | null) => {
      const nextOwns = ownsEvent(view, events, next)
      const nextDepartment = keepAssignee(departmentChoices(view, team, nextOwns), departmentId)
      setEventId(next)
      setDepartmentId(nextDepartment)
      setAssigneeId(keepAssignee(assigneeChoices(view, team, nextDepartment, nextOwns), assigneeId))
    },
    pickDepartment: (next: string | null) => {
      setDepartmentId(next)
      setAssigneeId(keepAssignee(assigneeChoices(view, team, next, owns), assigneeId))
    },
  }
}
