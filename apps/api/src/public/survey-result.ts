import { and, eq, ne } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events, students, surveyApplications, surveys } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import { eventFeeLabel } from '../events/participation-labels.ts'
import type { Clock } from './attendance.ts'
import { hashToken, looksLikeToken } from './tokens.ts'

export interface ApplyResult {
  title: string
  eventTitle: string
  applicantNote: string
  feeStatus: string
  feeNote?: string
  notices: Array<{ text: string }>
}

/**
 * 낸 사람의 결과 한 장(EXT-02B).
 *
 * **영수증으로만 연다.** 설문 토큰은 같은 링크를 연 모두가 가진 값이므로 그것으로
 * 열면 뒤에 낸 사람이 앞사람의 이름과 납부 상태를 본다.
 */
export async function applyResult(db: Db, receipt: string, time: Clock): Promise<ApplyResult> {
  if (!looksLikeToken(receipt)) throw new NotFound('그 결과를 찾지 못했습니다')
  const rows = await db
    .select({
      name: surveyApplications.name,
      studentNumber: surveyApplications.studentNumber,
      receiptExpiresAt: surveyApplications.receiptExpiresAt,
      orgId: surveys.orgId,
      duesCheck: surveys.duesCheck,
      completionTitle: surveys.completionTitle,
      eventTitle: events.title,
      fee: events.fee,
      feeType: events.feeType,
      paidAmount: events.paidAmount,
      unpaidAmount: events.unpaidAmount,
      contact: events.contact,
    })
    .from(surveyApplications)
    .innerJoin(surveys, eq(surveys.id, surveyApplications.surveyId))
    // 조직이 같은 행사만 잇는다 — 이음매마다 울타리를 다시 세운다.
    .leftJoin(events, and(eq(events.id, surveys.eventId), eq(events.orgId, surveys.orgId)))
    .where(eq(surveyApplications.receiptHash, hashToken(receipt)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 결과를 찾지 못했습니다')
  // **오래 사는 열쇠는 오래 새는 열쇠다.**
  if (time.now() > row.receiptExpiresAt) throw new NotFound('그 결과를 찾지 못했습니다')

  const fee = await feeOf(db, row)
  const notices = [{ text: '· 신청 내역은 이 링크로 다시 확인할 수 있습니다' }]
  // **몇 줄인지는 데이터가 정한다** — 문의처를 적지 않은 행사는 한 줄이다.
  if (row.contact !== null && row.contact !== '') notices.push({ text: `· 문의: ${row.contact}` })

  return {
    title: row.completionTitle ?? '신청이 완료되었습니다',
    eventTitle: row.eventTitle ?? '행사를 찾지 못했습니다',
    // **라벨까지 품은 완성된 한 줄이다** — 신청자를 무엇이라 부를지는 조직의 말이고
    // 화면이 이어 붙이면 그 말이 두 곳에 흩어진다.
    applicantNote: `신청자: ${row.name}`,
    ...fee,
    notices,
  }
}

/**
 * 참가비가 지금 어떤 상태인가.
 *
 * **금액일 수도 상태일 수도 있다.** 학생회비를 대조하는 행사는 명단에서 그 사람을
 * 찾아야 금액이 정해지고, 찾기 전에는 '관리자 확인 중'이다.
 *
 * 대조가 끝나도 이 자리는 행사 참가비 안내 한 줄을 그대로 쓴다. 개인별 금액을
 * 고르는 규칙은 별도 신청 정책이며 여기서 지어내지 않는다.
 */
async function feeOf(
  db: Db,
  row: {
    orgId: string
    duesCheck: boolean
    studentNumber: string
    fee: string | null
    feeType: string | null
    paidAmount: number | null
    unpaidAmount: number | null
  },
): Promise<{ feeStatus: string; feeNote?: string }> {
  const line = eventFeeLabel(row, '참가비 안내 없음')
  if (!row.duesCheck) return { feeStatus: line }

  const found = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.orgId, row.orgId),
        eq(students.studentNumber, row.studentNumber),
        // '확인 필요'로 표시된 사람은 아직 대조가 끝나지 않았다.
        ne(students.duesStatus, 'check'),
      ),
    )
    .limit(1)
  if (found.length > 0) return { feeStatus: line }
  return {
    feeStatus: '관리자 확인 중',
    // 금액이 이미 정해진 행사에는 이 줄이 오지 않는다.
    feeNote: '학생회비 납부 여부를 확인한 뒤 금액이 정해집니다.',
  }
}
