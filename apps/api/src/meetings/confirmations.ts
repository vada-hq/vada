import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetings } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import { daysBetween } from '../time.ts'
import { agendasOf, meetingOf, participantsOf } from './detail.ts'

/** 예정 시각보다 일찍 시작하는 경우 확인 문구를 만든다. */
export async function startConfirm(
  db: Db,
  orgId: string,
  meetingId: string,
  now: Date,
): Promise<{ warningNote?: string }> {
  const rows = await db
    .select({ scheduledAt: meetings.scheduledAt })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  if (row.scheduledAt === null) return {}
  const days = daysBetween(now, row.scheduledAt)
  if (days <= 0) return {}
  return {
    warningNote: `예정 시간보다 ${days}일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요.`,
  }
}

/** 종료 전 남은 안건과 참석 현황을 확인 문구로 만든다. */
export async function endConfirm(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<{ warningNote: string }> {
  await meetingOf(db, orgId, meetingId)
  const agendas = await agendasOf(db, orgId, meetingId)
  const people = await participantsOf(db, orgId, meetingId)
  const waiting = agendas.filter((one) => one.status === 'pending').length
  const present = people.filter((one) => one.attendance === 'present').length
  return {
    warningNote: `미완료 안건 ${waiting}개 · 참석 ${present}명 · 미참가 ${people.length - present}명`,
  }
}
