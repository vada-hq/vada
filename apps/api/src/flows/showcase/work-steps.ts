import type {
  CreateScheduleItemRequest,
  EventResponse,
  MeetingResponse,
  ScheduleItemResponse,
  TaskResponse,
} from '@vada/contracts'
import { create, read, sees, write } from '../rehearsal-kit.js'
import type { EventEntry, MeetingEntry, ScheduleEntry, TaskEntry } from './content/types.js'
import {
  departmentId,
  eventId,
  found,
  memberIdOf,
  org,
  seesPermission,
  who,
  type ShowcaseCtx,
} from './kit.js'

// 행사, 업무, 회의, 일정. 미래의 날짜(행사 날짜, 마감)는 값으로만 넣고 시계는 옮기지 않는다.

const momentOrNull = (ctx: ShowcaseCtx, moment: EventEntry['startsAt']) =>
  moment ? ctx.cal.koreanOf(moment) : null

// 행사 만들기: 만든 사람이 책임자다(DEC-79).
export async function createEventStep(ctx: ShowcaseCtx, entry: EventEntry) {
  const person = who(ctx, entry.by)
  await seesPermission(ctx, person, 'event.create')
  const created = await create<EventResponse>(
    person,
    `${org(ctx)}/events`,
    {
      name: entry.name,
      startsAt: momentOrNull(ctx, entry.startsAt),
      endsAt: momentOrNull(ctx, entry.endsAt),
      place: entry.place,
    },
    '행사 만들기',
  )
  ctx.w.events.set(entry.name, created.event.id)
}

// 행사 완료: 정산이 끝나 그 사람의 화면에 event.complete가 생겨야 한다(012).
export async function completeEventStep(ctx: ShowcaseCtx, entry: EventEntry) {
  const person = who(ctx, entry.complete!.by)
  const path = `${org(ctx)}/events/${eventId(ctx, entry.name)}`
  const before = await read<EventResponse>(person, path, '완료 전 행사 읽기')
  if (!before.event.actions.includes('event.complete'))
    throw new Error(`완료할 수 없다. 막힌 까닭: ${JSON.stringify(before.event.blockers)}`)
  await write<EventResponse>(person, `${path}/complete`, { reason: null }, '행사 완료')
}

export async function createTaskStep(ctx: ShowcaseCtx, entry: TaskEntry) {
  const person = who(ctx, entry.by)
  await seesPermission(ctx, person, 'task.manage')
  const created = await create<TaskResponse>(
    person,
    `${org(ctx)}/tasks`,
    {
      title: entry.title,
      dueDate: entry.due ? ctx.cal.dayOf(entry.due) : null,
      departmentId: entry.department ? departmentId(ctx, entry.department) : null,
      assigneeId: entry.assignee ? memberIdOf(ctx, entry.assignee) : null,
      eventId: entry.event ? eventId(ctx, entry.event) : null,
    },
    '업무 만들기',
  )
  ctx.w.tasks.set(entry.title, created.task.id)
}

// 상태는 담당자(없으면 만든 사람)가 바꾼다.
export async function taskStatusStep(ctx: ShowcaseCtx, entry: TaskEntry) {
  const person = who(ctx, entry.assignee ?? entry.by)
  const path = `${org(ctx)}/tasks/${found(ctx.w.tasks, entry.title, '업무')}`
  await sees<TaskResponse>(person, path, body => body.task.actions, 'task.change_status')
  await write<TaskResponse>(person, `${path}/status`, { status: entry.status!.to }, '업무 상태')
}

export async function createMeetingStep(ctx: ShowcaseCtx, entry: MeetingEntry) {
  const person = who(ctx, entry.by)
  await seesPermission(ctx, person, 'meeting.create')
  const created = await create<MeetingResponse>(
    person,
    `${org(ctx)}/meetings`,
    {
      title: ctx.cal.text(entry.title),
      heldAt: ctx.cal.koreanOf(entry.heldAt),
      endsAt: ctx.cal.koreanOf(entry.endsAt),
      place: entry.place,
      agenda: entry.agenda.map(item => ({ title: item.title, body: null })),
    },
    '회의 만들기',
  )
  ctx.w.meetings.set(entry.title, created.meeting.id)
}

// 회의록: 안건마다 메모를 적고 결정을 더한다. 안건은 만든 차례(position)로 찾는다.
export async function writeMinutesStep(ctx: ShowcaseCtx, entry: MeetingEntry) {
  const person = who(ctx, entry.by)
  const path = `${org(ctx)}/meetings/${found(ctx.w.meetings, entry.title, '회의')}`
  const { meeting } = await sees<MeetingResponse>(
    person,
    path,
    body => body.meeting.actions,
    'meeting.minutes',
  )
  const agenda = [...meeting.agenda].sort((a, b) => a.position - b.position)
  for (const [index, item] of entry.agenda.entries()) {
    const target = agenda[index]!
    if (item.notes)
      await write<MeetingResponse>(
        person,
        `${path}/agenda/${target.id}`,
        { notes: ctx.cal.text(item.notes), baseVersionNo: target.versionNo },
        '안건 메모',
      )
    for (const decision of item.decisions ?? [])
      await create<MeetingResponse>(
        person,
        `${path}/agenda/${target.id}/decisions`,
        { content: ctx.cal.text(decision.content), rationale: decision.rationale ?? null },
        '결정 더하기',
      )
  }
}

export async function confirmMeetingStep(ctx: ShowcaseCtx, entry: MeetingEntry) {
  const person = who(ctx, entry.by)
  const path = `${org(ctx)}/meetings/${found(ctx.w.meetings, entry.title, '회의')}`
  await sees<MeetingResponse>(person, path, body => body.meeting.actions, 'meeting.confirm')
  await write<MeetingResponse>(person, `${path}/confirm`, {}, '회의록 확정')
}

export async function createScheduleStep(ctx: ShowcaseCtx, entry: ScheduleEntry) {
  const person = who(ctx, entry.by)
  await seesPermission(ctx, person, 'schedule.create')
  const { when } = entry
  const body: CreateScheduleItemRequest = {
    title: entry.title,
    type: entry.type,
    when: when.allDay
      ? { allDay: true, startsOn: ctx.cal.dayOf(when.on), endsOn: null }
      : {
          allDay: false,
          startsAt: ctx.cal.koreanOf(when.startsAt),
          endsAt: when.endsAt ? ctx.cal.koreanOf(when.endsAt) : null,
        },
    place: entry.place,
    departmentId: null,
    visibility: 'council',
    eventId: null,
    memo: null,
  }
  await create<ScheduleItemResponse>(person, `${org(ctx)}/schedule`, body, '일정 만들기')
}
