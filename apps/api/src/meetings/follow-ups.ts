import { and, asc, eq, ne } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetings, members, tasks } from '../db/schema.ts'
import { NotFound } from '../routes.ts'
import { shortStamp } from '../time.ts'
import type { MeetingViewer } from './meetings.ts'

// 회의에서 나온 후속 업무(OPS-MEET-05A · 06B · 07 · 08이 읽는다).
//
// **회의가 만든 업무도 업무 표에 산다.** `tasks.from_meeting_id`가 그 이음이고,
// 회의가 제 표에 따로 담지 않는다 — 담으면 같은 업무가 두 곳에 있게 되고 칸반에
// 안 올라온다.
//
// ## 왜 자리가 둘인가
//
// '이 회의가 만든 후속 업무'와 '그중 내 것'은 **다른 물음**이다. 한동안 같은 출처에
// 인자를 붙여 갈랐는데, 그러면 **비었을 때 할 말이 하나뿐이 된다** — 07은 '회의록
// 정리에서 생성한 후속 업무 카드가 여기에 표시됩니다'라 적었고 08은 '나에게 배정된
// 미완료 후속 업무가 없습니다'라 적었다. 비었다는 말이 다르면 묻는 것이 다른 것이다.
//
// ## 그림이 빈 상태만 그렸다
//
// 07·08 둘 다 0건이라 항목이 무엇으로 이루어지는지 그림이 말하지 않는다. 채워진
// 모습은 06B의 안건별 후속 업무에만 있고(이름 · 기한), 그래서 조각도 셋뿐이다.
// **어느 안건에서 나왔는지는 붙이지 않는다** — 그것을 담는 열이 `tasks`에 없다
// (05A가 '위 결정사항에서 생성'이라 그렸지만 지어낼 수는 없다).

export interface MeetingFollowUp {
  taskId: string
  title: string
  assigneeNote?: string
}

/** `07.23` — 기한은 날짜까지만 그린다(06B가 그렇게 그렸다). 시간대는 `time.ts`가 안다. */
function dueDay(when: Date): string {
  return shortStamp(when).split(' ')[0]!
}

/** 그 학생회의 그 회의인가. **없는 것은 없다고 말한다.** */
async function meetingOf(db: Db, orgId: string, meetingId: string): Promise<void> {
  const rows = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  if (rows[0] === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
}

/**
 * 이 회의에 걸린 업무들. 기한이 이른 것부터 오고 기한 없는 것이 뒤에 선다.
 *
 * **이어 붙인 표도 자기 학생회를 확인한다.** 벽은 두 겹이 낫다.
 */
async function linkedTasks(db: Db, orgId: string, meetingId: string) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      assigneeMemberId: tasks.assigneeMemberId,
      dueDate: tasks.dueDate,
      assignee: members.name,
    })
    .from(tasks)
    .leftJoin(
      members,
      and(eq(tasks.assigneeMemberId, members.id), eq(members.orgId, orgId)),
    )
    .where(and(eq(tasks.orgId, orgId), eq(tasks.fromMeetingId, meetingId)))
    .orderBy(asc(tasks.dueDate), asc(tasks.id))
}

/**
 * 누가 언제까지.
 *
 * **잇는 것은 서버의 일이다.** 화면이 이름과 날짜를 이으면 잇는 방법이 화면마다
 * 갈린다. **붙일 것이 하나도 없으면 이 조각은 오지 않는다** — 빈 글을 주면 화면이
 * 빈 자리를 그린다(목록의 딱지와 같은 규칙이다).
 */
function assigneeNote(assignee: string | null, dueDate: Date | null): string | undefined {
  const said: string[] = []
  if (assignee !== null && assignee.trim() !== '') said.push(assignee)
  if (dueDate !== null) said.push(`${dueDay(dueDate)}까지`)
  return said.length === 0 ? undefined : said.join(' · ')
}

function drawn(row: {
  id: string
  title: string
  assignee: string | null
  dueDate: Date | null
}): MeetingFollowUp {
  const one: MeetingFollowUp = { taskId: row.id, title: row.title }
  const note = assigneeNote(row.assignee, row.dueDate)
  if (note !== undefined) one.assigneeNote = note
  return one
}

/** 이 회의에서 나온 후속 업무 전부(`meeting.followUps`). */
export async function meetingFollowUps(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MeetingFollowUp[]> {
  await meetingOf(db, orgId, meetingId)
  return (await linkedTasks(db, orgId, meetingId)).map(drawn)
}

/**
 * 그중 나에게 배정된 **미완료** 업무(`meeting.myFollowUps`).
 *
 * '미완료'는 08이 적은 말이다 — 이미 끝낸 업무는 확인할 것이 남아 있지 않다.
 * 거르는 것은 조회의 일이다: 화면이 받아 온 것을 걸러 내면 그 규칙이 화면에 박힌다.
 */
export async function myMeetingFollowUps(
  db: Db,
  orgId: string,
  meetingId: string,
  viewer: MeetingViewer,
): Promise<MeetingFollowUp[]> {
  await meetingOf(db, orgId, meetingId)
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      assignee: members.name,
    })
    .from(tasks)
    .leftJoin(
      members,
      and(eq(tasks.assigneeMemberId, members.id), eq(members.orgId, orgId)),
    )
    .where(
      and(
        eq(tasks.orgId, orgId),
        eq(tasks.fromMeetingId, meetingId),
        eq(tasks.assigneeMemberId, viewer.memberId),
        ne(tasks.status, 'done'),
      ),
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.id))
  return rows.map(drawn)
}
