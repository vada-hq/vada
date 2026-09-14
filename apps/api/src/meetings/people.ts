import { and, eq, ilike, or } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, meetingParticipants, members } from '../db/schema.ts'
import { attendanceChip, meetingOf, participantsOf, runs } from './detail.ts'
import { listed, orNote, type Listed } from './meetings.ts'

export interface MeetingPerson {
  memberId: string
  name: string
  department: string
  departmentNote: string
  chips: Array<{ label: string; tone: string }>
  capabilityNote: string
  attendanceLabel: string
  attendanceTone: string
  isPresent?: boolean
  actionLabel?: string
  actionEmphasis?: string
  actionEnabled?: boolean
}

export interface MeetingPeopleQuery {
  query?: string
  excludeHostOwner?: boolean
}

/** 참가자 검색, 권한 표시와 참석 상태를 한 목록으로 만든다. */
export async function meetingPeople(
  db: Db,
  orgId: string,
  meetingId: string,
  asked: MeetingPeopleQuery,
  allowed: { canManageHostRole: boolean },
): Promise<MeetingPerson[]> {
  const meeting = await meetingOf(db, orgId, meetingId)
  const stage: Listed = listed(meeting.status) ? meeting.status : 'scheduled'
  const wanted = (asked.query ?? '').trim()
  const rows = await db
    .select({
      memberId: meetingParticipants.memberId,
      isHost: meetingParticipants.isHost,
      attendance: meetingParticipants.attendance,
      name: members.name,
      department: departments.name,
    })
    .from(meetingParticipants)
    .innerJoin(members, and(eq(meetingParticipants.memberId, members.id), eq(members.orgId, orgId)))
    .leftJoin(departments, and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)))
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.meetingId, meetingId),
        wanted === '' ? undefined : or(ilike(members.name, `%${wanted}%`), ilike(departments.name, `%${wanted}%`)),
      ),
    )
  const order = (row: (typeof rows)[number]) =>
    `${row.memberId === meeting.creatorMemberId ? 0 : 1}${runs(row, meeting.creatorMemberId) ? 0 : 1}${row.name}`
  const everyone = await participantsOf(db, orgId, meetingId)
  const runners = everyone.filter((one) => runs(one, meeting.creatorMemberId)).length

  return [...rows]
    .filter((row) => !(asked.excludeHostOwner === true && row.memberId === meeting.creatorMemberId))
    .sort((left, right) => order(left).localeCompare(order(right)))
    .map((row) => {
      const isCreator = row.memberId === meeting.creatorMemberId
      const isRunner = runs(row, meeting.creatorMemberId)
      const chips: Array<{ label: string; tone: string }> = []
      if (isCreator) chips.push({ label: '회의 생성자', tone: 'gray' })
      if (isRunner) chips.push({ label: '진행 권한', tone: 'blue' })
      const attendance = attendanceChip(stage, row.attendance)
      const drawn: MeetingPerson = {
        memberId: row.memberId,
        name: row.name,
        department: orNote(row.department, '부서 미배정'),
        departmentNote: `${orNote(row.department, '부서 미배정')} · 회의 참가자`,
        chips,
        capabilityNote: isRunner ? '시작·종료 가능' : '일반 참가자',
        attendanceLabel: attendance.label,
        attendanceTone: attendance.tone,
      }
      if (stage === 'inProgress' && row.attendance === 'present') drawn.isPresent = true
      if (allowed.canManageHostRole && !isCreator) {
        drawn.actionLabel = row.isHost ? '권한 해제' : '진행 권한 부여'
        drawn.actionEmphasis = row.isHost ? 'secondary' : 'primary'
        drawn.actionEnabled = row.isHost ? runners > 1 : true
      }
      return drawn
    })
}
