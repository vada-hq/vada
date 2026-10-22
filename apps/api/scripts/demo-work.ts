import { and, eq } from 'drizzle-orm'
import type { Actor } from '../src/access/actor.js'
import { sendMessage } from '../src/chat/send.js'
import { chatRoom, record } from '../src/db/schema.js'
import type { Tx } from '../src/db/types.js'
import { createEvent } from '../src/events/service.js'
import { changeTaskStatus, createTask } from '../src/tasks/service.js'
import { demoDay } from './demo-dates.js'
import type { DemoCast } from './demo-people.js'

// 시연 학생회의 일: 행사 셋(끝남, 예정, 날짜 미정)과 행사 업무, 학생회 업무, 전체방 메시지.
// 행사는 회장이 만들고, 업무는 만드는 쪽 권한(부서 부장 기준, 행사 책임자)을 서비스 함수가 따진다.

async function addEvents(tx: Tx, cast: DemoCast, now: Date) {
  const make = async (input: {
    name: string
    startsAt: string | null
    endsAt: string | null
    place: string | null
    ownerId: string | null
  }) => (await createEvent(tx, cast.president, input, now)).id
  const ended = demoDay(now, 'endedEvent')
  const upcoming = demoDay(now, 'upcomingEvent')
  return {
    ended: await make({
      name: '신입생 환영회',
      startsAt: `${ended}T18:00`,
      endsAt: `${ended}T21:00`,
      place: '학생회관 대강당',
      ownerId: cast.planningHead.memberId,
    }),
    upcoming: await make({
      name: '2학기 개강 총회',
      startsAt: `${upcoming}T18:00`,
      endsAt: `${upcoming}T20:00`,
      place: '공학관 101호',
      ownerId: cast.planningHead.memberId,
    }),
    undated: await make({
      name: '졸업생 간담회',
      startsAt: null,
      endsAt: null,
      place: null,
      ownerId: null,
    }),
  }
}
type DemoEvents = Awaited<ReturnType<typeof addEvents>>

type TaskInput = {
  title: string
  body?: string
  dueDate?: string
  department?: Actor
  assignee?: Actor
  eventId?: string
}

const taskMaker = (tx: Tx, now: Date) => async (by: Actor, task: TaskInput) =>
  (
    await createTask(
      tx,
      by,
      {
        title: task.title,
        body: task.body ?? null,
        dueDate: task.dueDate ?? null,
        departmentId: task.department?.departments[0]?.departmentId ?? null,
        assigneeId: task.assignee?.memberId ?? null,
        eventId: task.eventId ?? null,
      },
      now,
    )
  ).task.id

// 기획부장이 행사 업무를 만들어 기획부원에게 맡기고, 기획부원이 상태를 바꾼다.
async function addPlanningTasks(tx: Tx, cast: DemoCast, ctx: { events: DemoEvents; now: Date }) {
  const { events, now } = ctx
  const make = taskMaker(tx, now)
  const planning = { assignee: cast.planningMember, department: cast.planningHead }
  const hall = await make(cast.planningHead, {
    ...planning,
    title: '대강당 사용 신청서 내기',
    dueDate: demoDay(now, 'endedEventTaskDue'),
    eventId: events.ended,
  })
  await changeTaskStatus(tx, cast.planningMember, { taskId: hall, now }, { status: 'done' })
  const room = await make(cast.planningHead, {
    ...planning,
    title: '총회 장소 예약 확인',
    dueDate: demoDay(now, 'roomTaskDue'),
    eventId: events.upcoming,
  })
  await changeTaskStatus(tx, cast.planningMember, { taskId: room, now }, { status: 'in_progress' })
}

async function addOtherTasks(tx: Tx, cast: DemoCast, ctx: { events: DemoEvents; now: Date }) {
  const { events, now } = ctx
  const make = taskMaker(tx, now)
  const finance = { assignee: cast.financeMember, department: cast.financeHead }
  await make(cast.financeHead, {
    ...finance,
    title: '총회 간식 구매 요청서 쓰기',
    dueDate: demoDay(now, 'snackTaskDue'),
    eventId: events.upcoming,
  })
  // 책임자 없는 행사의 업무는 회장단이 만든다.
  await make(cast.president, {
    title: '간담회 가능한 날짜 조사',
    body: '졸업생 단체방에 후보 날짜를 올려 주세요.',
    assignee: cast.planningHead,
    department: cast.planningHead,
    eventId: events.undated,
  })
  await make(cast.president, {
    ...finance,
    title: '학생회비 납부 안내문 올리기',
    dueDate: demoDay(now, 'noticeTaskDue'),
  })
  await make(cast.president, { title: '동아리방 청소 당번표 정하기' })
}

async function allMembersRoomOf(tx: Tx, councilId: string) {
  const [room] = await tx
    .select({ id: chatRoom.id })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .where(and(eq(record.councilId, councilId), eq(chatRoom.type, 'all_members')))
  if (!room) throw new Error('Council has no all-members room')
  return room.id
}

async function addChat(tx: Tx, cast: DemoCast, now: Date) {
  const roomId = await allMembersRoomOf(tx, cast.president.councilId)
  const say = (by: Actor, body: string) =>
    sendMessage(tx, by, { roomId, body, mentions: [], photos: [] }, now)
  await say(cast.president, '이번 학기도 잘 부탁드립니다. 행사 준비는 여기서 같이 이야기해요.')
  await say(cast.planningHead, '개강 총회 장소는 공학관 101호로 잡았어요.')
  await say(cast.financeHead, '간식 구매 요청서는 올려 주시면 바로 확인할게요.')
  await say(cast.president, '환영회 정산도 이번 주 안에 마무리해 주세요.')
}

export async function addWork(tx: Tx, cast: DemoCast, now: Date) {
  const events = await addEvents(tx, cast, now)
  await addPlanningTasks(tx, cast, { events, now })
  await addOtherTasks(tx, cast, { events, now })
  await addChat(tx, cast, now)
}
