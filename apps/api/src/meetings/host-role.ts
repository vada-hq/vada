import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, meetingParticipants, meetings, members } from '../db/schema.ts'
import { NotFound } from '../routes.ts'
import { orNote } from './meetings.ts'

// 진행 권한(OPS-MEET-04B의 안내·맨 위 칸과 D03의 확인 글).
//
// **권한이 무엇을 주고 무엇을 안 주는지를 서버가 글로 든다.** 명세가 이 글을 들면
// 권한이 하나 늘 때마다 명세가 틀리고, 화면이 들면 화면마다 다른 말이 나온다.
//
// **진행 권한은 옮기는 것이 아니라 더하는 것이다**(D03의 '권한 부여'). 만든 사람은
// `meeting_participants.is_host`가 아니어도 진행할 수 있다 — 그것은
// `meetings.creator_member_id`가 말한다.

/** 04B와 D03이 나눠 쓰는 안내. 04B의 상자 하나에 두 문장으로 그려져 있다. */
const NOTICE = {
  title: '이 회의에만 적용되는 권한입니다',
  grantNote:
    '진행 권한자는 회의 시작·종료, 안건 진행, 결정 기록과 회의록 정리를 할 수 있습니다.',
  limitNote: '회의 수정·취소와 다른 사람의 권한 변경은 회의 생성자만 할 수 있습니다.',
  /** 지켜야 하는 규칙. 진행 권한자를 하나도 없게 만들 수는 없다. */
  ruleChipLabel: '최소 1명 유지',
  ruleChipTone: 'yellow',
} as const

/** D03의 확인 글. **04B의 안내와 다른 문장이다** — 한 사람에게 무엇이 생기는지를 말한다. */
const GRANT = {
  grantNote:
    '이 회의에서 회의 시작·종료, 안건 진행, 의사결정 기록과 회의록 정리를 할 수 있게 됩니다.',
  limitNote: '회의 수정·취소와 다른 참가자의 권한 변경은 할 수 없습니다.',
} as const

/** 그 학생회의 그 회의인가. **없는 것은 없다고 말한다.** */
async function meetingOf(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({ id: meetings.id, creatorMemberId: meetings.creatorMemberId })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

export interface MeetingHostOwner {
  name: string
  departmentNote: string
  chips: Array<{ label: string; tone: string }>
  capabilityNote: string
}

/**
 * 회의를 만든 사람 한 명(`meeting.hostOwner`).
 *
 * **목록의 한 줄이 아니라 제 자리다.** 04B가 맨 위 칸에 따로 그리고 목록에서는 뺀다
 * (`meeting.participants`의 `excludeHostOwner`).
 *
 * **값도 목록의 그 줄과 다르다.** 04B는 이 사람을 '권한 변경 및 회의 관리 가능'이라
 * 적고 03A는 같은 사람을 '시작·종료 가능'이라 적는다 — 무엇을 보여주는 자리냐가
 * 다르기 때문이다.
 */
export async function meetingHostOwner(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MeetingHostOwner> {
  const meeting = await meetingOf(db, orgId, meetingId)
  // 만든 사람이 이 학생회를 떠났거나 애초에 없는 회의가 있다. **지어내지 않는다.**
  if (meeting.creatorMemberId === null) throw new NotFound('회의 생성자를 찾지 못했습니다')

  const rows = await db
    .select({ name: members.name, department: departments.name })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(members.orgId, orgId), eq(members.id, meeting.creatorMemberId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('회의 생성자를 찾지 못했습니다')

  return {
    name: row.name,
    // 부서가 없으면 가운뎃점만 남은 글을 주지 않는다.
    departmentNote: `${orNote(row.department, '부서 미배정')} · 권한 변경 및 회의 관리 가능`,
    // **만든 사람은 둘을 함께 단다.** 만든 사실에서 진행 권한이 따라온다(ORG-04).
    chips: [
      { label: '회의 생성자', tone: 'gray' },
      { label: '진행 권한', tone: 'blue' },
    ],
    // 이 사람은 뺄 수 없다 — 04B가 이 줄에 단추를 안 그렸다.
    capabilityNote: '필수 권한자',
  }
}

export interface MeetingPermissionNotice {
  title: string
  grantNote: string
  limitNote: string
  ruleChipLabel: string
  ruleChipTone: string
  summaryNote: string
}

/**
 * 진행 권한이 무엇을 주고 무엇을 안 주는지(`meeting.permissionNotice`).
 *
 * **지금 몇 명인지는 세어서 붙인다.** 화면이 목록을 받아 세면 그 규칙이 화면에
 * 박히고, 검색으로 좁힌 목록이 권한자의 수를 바꾸는 일이 생긴다.
 */
export async function meetingPermissionNotice(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MeetingPermissionNotice> {
  const meeting = await meetingOf(db, orgId, meetingId)
  const people = await db
    .select({
      memberId: meetingParticipants.memberId,
      isHost: meetingParticipants.isHost,
    })
    .from(meetingParticipants)
    .innerJoin(members, and(eq(meetingParticipants.memberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(meetingParticipants.orgId, orgId), eq(meetingParticipants.meetingId, meetingId)))

  // 만든 사람은 `is_host`가 아니어도 진행 권한자다. 04B의 목록도 그렇게 딱지를 단다.
  const runners = people.filter(
    (one) => one.isHost || one.memberId === meeting.creatorMemberId,
  ).length

  return {
    ...NOTICE,
    summaryNote: `현재 진행 권한자 ${runners}명 · 일반 참가자 ${people.length - runners}명`,
  }
}

export interface MeetingHostGrantConfirm {
  title: string
  grantNote: string
  limitNote: string
}

/**
 * 누구에게 진행 권한을 주려는지(`meeting.hostGrantConfirm`).
 *
 * **제목에 사람 이름이 박혀 있으므로 서버가 완성해 준다** — 명세가 '{이름}에게 …'를
 * 조립하면 그 문장이 명세의 것이 되고 '진행 권한'이라는 역할 이름이 명세에 고정된다.
 *
 * **이 회의의 참가자여야 한다.** D03은 04B의 줄에서 열리고, 그 목록에 없는 사람에게
 * 줄 권한이 없다 — 없는 사람을 물으면 없다고 말한다.
 */
export async function meetingHostGrantConfirm(
  db: Db,
  orgId: string,
  meetingId: string,
  memberId: string,
): Promise<MeetingHostGrantConfirm> {
  await meetingOf(db, orgId, meetingId)
  const rows = await db
    .select({ name: members.name })
    .from(meetingParticipants)
    .innerJoin(members, and(eq(meetingParticipants.memberId, members.id), eq(members.orgId, orgId)))
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.meetingId, meetingId),
        eq(meetingParticipants.memberId, memberId),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 참가자를 찾지 못했습니다')

  return { title: `${row.name}에게 진행 권한을 부여할까요?`, ...GRANT }
}
