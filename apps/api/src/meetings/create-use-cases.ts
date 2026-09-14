import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetings } from '../db/schema.ts'
import type { MeetingViewer } from './meetings.ts'
import { readMeetingDraft } from './create-input.ts'
import { replaceMeetingParts } from './create-persistence.ts'
import type { MakeMeeting } from './create-types.ts'

/**
 * 회의를 만든다(OPS-MEET-02의 '회의 만들기').
 *
 * **만든 사람은 서버가 안다.** 몸통에 실려 오는 주최자 이름은 읽기 전용 칸에 그린
 * 글이고, 그것을 믿으면 남의 이름으로 회의를 만들 수 있다.
 */
export async function createMeeting(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  draft: Record<string, unknown>,
  make: MakeMeeting,
): Promise<{ id: string }> {
  const read = await readMeetingDraft(db, orgId, draft)
  const id = make.id()
  const at = make.now()
  await db.insert(meetings).values({
    id,
    orgId,
    title: read.title,
    kind: read.kind,
    eventId: read.eventId,
    departmentId: read.departmentId,
    purpose: read.purpose,
    // **새 회의는 예정으로 생긴다.** 화면의 안내가 그렇게 적었다.
    status: 'scheduled',
    scheduledAt: read.scheduledAt,
    plannedEndAt: read.plannedEndAt,
    mode: read.mode,
    place: read.place,
    onlineLink: read.onlineLink,
    isPrivate: read.isPrivate,
    creatorMemberId: viewer.memberId,
    createdAt: at,
    updatedAt: at,
  })
  await replaceMeetingParts(db, orgId, id, read, make)
  return { id }
}

/**
 * 회의를 임시 저장한다(OPS-MEET-02의 '임시 저장').
 *
 * **덮어쓰기다.** 명세가 `repeat: overwrite`와 '초안은 회의마다 하나뿐이다'라고
 * 적었다. 그런데 이 자리는 **어느 회의의 초안인지를 받지 않는다** — 보내는 길에
 * 인자가 하나도 없다. 그래서 덮어쓸 것을 정할 수 있는 유일한 사실이 '이 사람이
 * 쓰던 초안'이고, 그것으로 잡는다. 새로 넣기만 하면 임시 저장을 누를 때마다 초안이
 * 하나씩 쌓이고, 그러면 어느 것이 그 사람이 쓰던 것인지 아무도 모른다.
 */
export async function saveMeetingDraft(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  draft: Record<string, unknown>,
  make: MakeMeeting,
): Promise<{ id: string }> {
  const read = await readMeetingDraft(db, orgId, draft)
  const at = make.now()
  const already = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.status, 'draft'),
        eq(meetings.creatorMemberId, viewer.memberId),
      ),
    )
    .limit(1)

  const stored = {
    title: read.title,
    kind: read.kind,
    eventId: read.eventId,
    departmentId: read.departmentId,
    purpose: read.purpose,
    scheduledAt: read.scheduledAt,
    plannedEndAt: read.plannedEndAt,
    mode: read.mode,
    place: read.place,
    onlineLink: read.onlineLink,
    isPrivate: read.isPrivate,
    updatedAt: at,
  }

  const found = already[0]
  const id = found?.id ?? make.id()
  if (found === undefined) {
    await db.insert(meetings).values({
      id,
      orgId,
      // **임시 저장한 회의는 다른 참가자에게 보이지 않는다.** 그것도 회의이므로
      // 표를 따로 두지 않고 단계로 둔다.
      status: 'draft',
      creatorMemberId: viewer.memberId,
      createdAt: at,
      ...stored,
    })
  } else {
    await db
      .update(meetings)
      .set(stored)
      // 고칠 때도 학생회를 다시 건다. 위에서 찾았다고 여기서 빼면 울타리가 한 겹이 된다.
      .where(and(eq(meetings.orgId, orgId), eq(meetings.id, id)))
  }
  await replaceMeetingParts(db, orgId, id, read, make)
  return { id }
}
