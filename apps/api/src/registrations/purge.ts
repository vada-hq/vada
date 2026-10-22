import { and, eq, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { koreanDateOf } from '@vada/contracts'
import { event, registration, registrationForm } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { removeLinks } from './link.js'
import { clearVersionValues, idList } from './personal-values.js'
import { purgeOnOf } from './purge-date.js'

// 신청자 정보(이름, 학번, 휴대폰)를 지금 값과 모든 판에서 비우고 개인 링크 줄을 지운다(DEC-54, DEC-55). 행은 남고 판은 새로 열지 않는다.
// 판 비우기와 링크 지우기는 스스로 취소(cancel-mine.ts)와 같은 도우미를 쓴다.
async function clearApplicants(tx: Tx, formIds: string[]) {
  const rows = await tx
    .select({ id: registration.id })
    .from(registration)
    .where(inArray(registration.formId, formIds))
  const ids = rows.map(row => row.id)
  if (!ids.length) return
  await clearVersionValues(tx, ids)
  await tx.execute(sql`UPDATE registration SET name = NULL, student_id = NULL, phone = NULL
    WHERE id IN ${idList(ids)} AND (name IS NOT NULL OR student_id IS NOT NULL OR phone IS NOT NULL)`)
  await removeLinks(tx, ids)
}

// 지울 것이 남은 양식(값이 있는 신청이나 개인 링크가 남은 양식)과 지울 날 계산에 쓰는 날짜들
async function candidatesOf(tx: Pick<Db, 'selectDistinct'>, formId?: string) {
  const live = or(
    isNotNull(registration.name),
    isNotNull(registration.studentId),
    isNotNull(registration.phone),
    sql`EXISTS (SELECT 1 FROM registration_link l WHERE l.registration_id = ${registration.id})`,
  )
  return tx
    .selectDistinct({
      id: registrationForm.id,
      closesAt: registrationForm.closesAt,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
    })
    .from(registrationForm)
    .innerJoin(event, eq(event.id, registrationForm.eventId))
    .innerJoin(registration, eq(registration.formId, registrationForm.id))
    .where(and(live, formId ? eq(registrationForm.id, formId) : undefined))
}

// 지울 날(행사 끝+1년의 한국 날짜)이 오늘이거나 지났다. 날짜는 한국 날짜로 견주므로 한국 자정에 바뀐다.
const isDue = (form: Awaited<ReturnType<typeof candidatesOf>>[number], now: Date) =>
  purgeOnOf(form) <= koreanDateOf(now)

// 기한이 지난 모든 양식의 신청자 정보를 비운다. 같은 일을 두 번 해도 같다.
export async function purgeRegistrations(tx: Tx, now: Date) {
  const due = (await candidatesOf(tx)).filter(form => isDue(form, now)).map(form => form.id)
  if (due.length) await clearApplicants(tx, due)
}

// 양식 하나(와 그 신청자 목록)를 읽기 전에 그 양식의 지울 것을 먼저 지운다. 없는 번호는 아무 일도 하지 않는다.
// 읽기 거래는 쓰지 못하므로 부르는 쪽이 읽기 거래 앞에서 따로 부른다.
export async function purgeFormIfDue(db: Db, formId: string, now: Date) {
  await db.transaction(async tx => {
    const due = (await candidatesOf(tx, formId))
      .filter(form => isDue(form, now))
      .map(form => form.id)
    if (due.length) await clearApplicants(tx, due)
  })
}

// 1년이 지난 열람 기록을 지운다(DEC-56). 기준은 기록한 시각이다.
export async function purgeAccessLogs(tx: Tx, now: Date) {
  await tx.execute(
    sql`DELETE FROM applicant_access_log WHERE accessed_at <= (${now.toISOString()}::timestamptz - interval '1 year')`,
  )
}
