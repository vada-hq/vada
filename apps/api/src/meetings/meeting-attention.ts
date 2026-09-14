import { and, eq, sql } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { departments, meetingParticipants, meetings, members } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import type { MeetingViewer } from './meeting-list.ts'

// 회의 목록 위에서 보는 사람의 역할과 확인할 항목을 요약한다.

export interface MeetingAttention {
  viewerTitle: string
  viewerNote: string
  attentionNote: string
  canCreateMeeting: boolean
}

/** 역할의 이름은 **명세가 갖고 있다**(org.baseRoles). 두 벌을 들면 갈린다. */
const ROLE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'org.baseRoles') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

/**
 * 회의 목록 위의 띠(OPS-MEET-01A).
 *
 * **와이어프레임이 넷을 그렸다** — 일반 참가자·진행 권한자·회의 생성 가능·미참가자.
 * 누가 보느냐는 서버만 알므로 제목도 설명도 곁의 값도 여기서 나온다.
 *
 * 넷을 무엇이 가르는지는 그림이 말하지 않아 **회의와의 관계가 진한 쪽부터** 잡는다:
 * 진행 권한을 가진 회의가 있으면 그 자리가 먼저이고, 초대만 받았으면 참가자이고,
 * 아무 회의에도 없으면 그 사람이 무엇을 할 수 있는지로 갈린다. 그래야 넷이 다 나온다.
 *
 * 곁의 한 줄은 **셀 것이 있을 때만** 온다 — 명세가 '회의 생성 가능·미참가자 화면에는
 * 그려지지 않는다'고 적었고, 그 둘은 아무 회의에도 없으므로 셀 것이 저절로 없다.
 */
export async function meetingAttention(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  allowed: { canCreateMeeting: boolean },
): Promise<MeetingAttention> {
  const rows = await db
    .select({
      isHost: meetingParticipants.isHost,
      acknowledgedAt: meetingParticipants.acknowledgedAt,
      status: meetings.status,
    })
    .from(meetingParticipants)
    .innerJoin(
      meetings,
      and(eq(meetingParticipants.meetingId, meetings.id), eq(meetings.orgId, orgId)),
    )
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.memberId, viewer.memberId),
        sql`${meetings.status} <> 'draft'`,
      ),
    )

  // **아직 확인하지 않은 회의 요약.** 정리 완료된 회의의 요약을 확인했는지는
  // 회의의 상태가 아니라 **이 사람의 상태**다(OPS-MEET-08).
  const needCheck = rows.filter(
    (row) => row.status === 'done' && row.acknowledgedAt === null,
  ).length
  // 끝난 회의의 진행 권한은 세지 않는다 — 할 것이 남은 회의만 곁에 알린다.
  const hosting = rows.filter(
    (row) => row.isHost && row.status !== 'done' && row.status !== 'cancelled',
  ).length
  const isHost = rows.some((row) => row.isHost)

  const parts = []
  if (needCheck > 0) parts.push(`확인 필요한 회의 ${needCheck}건`)
  if (hosting > 0) parts.push(`진행 권한 ${hosting}건`)

  return {
    ...(await band(db, orgId, viewer, {
      isHost,
      joined: rows.length > 0,
      canCreateMeeting: allowed.canCreateMeeting,
    })),
    attentionNote: parts.join(' · '),
    canCreateMeeting: allowed.canCreateMeeting,
  }
}

/**
 * 띠의 제목과 설명.
 *
 * 설명은 **그림이 이미 적어 둔 말**에서 온다 — 진행 권한자가 무엇을 할 수 있는지는
 * OPS-MEET-02가, 미참가자가 무엇을 열 수 있는지는 OPS-MEET-01D의 갈래가 적었다.
 */
async function band(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  seen: { isHost: boolean; joined: boolean; canCreateMeeting: boolean },
): Promise<{ viewerTitle: string; viewerNote: string }> {
  if (seen.isHost) {
    return {
      viewerTitle: '진행 권한자 화면',
      viewerNote: '진행 권한을 가진 회의는 시작·종료하고 안건과 회의록을 정리할 수 있습니다.',
    }
  }
  if (seen.joined) {
    return {
      viewerTitle: '일반 참가자 화면',
      viewerNote: '초대된 회의의 일정과 참가 상태를 확인합니다.',
    }
  }
  if (!seen.canCreateMeeting) {
    return {
      viewerTitle: '미참가자 화면',
      viewerNote: '초대되지 않은 회의는 상세만 열람할 수 있습니다.',
    }
  }
  // 만들 수 있는 사람에게는 **그 사람이 누구인지**를 말한다. 아직 어느 회의에도
  // 들어 있지 않으므로 회의와의 관계로는 부를 이름이 없다.
  const rows = await db
    .select({ name: members.name, role: members.role, department: departments.name })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(members.orgId, orgId), eq(members.id, viewer.memberId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 구성원을 찾지 못했습니다')
  const place = [row.department, ROLE_LABEL.get(row.role) ?? row.role].filter(
    (part): part is string => part !== null && part !== '',
  )
  return {
    viewerTitle: `${row.name} (${place.join(' ')})`,
    viewerNote: '새 회의를 만들고 참가자와 안건을 등록할 수 있습니다.',
  }
}
