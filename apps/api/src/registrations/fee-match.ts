import { and, eq, gte, lte } from 'drizzle-orm'
import { koreanDateOf } from '@vada/contracts'
import { feePayment } from '../db/schema.js'
import type { Db } from '../db/types.js'

type FormFees = { payerFee: string | null; nonPayerFee: string | null }

// 적용 참가비(DEC-26): 참가비가 없으면 0, 두 값이 같으면 그 값, 다르면 학번이 그 학생회 명단에서 신청한 날(한국)을 납부 기간 안에 품으면 납부자 참가비, 아니면 미납자 참가비.
// 신청 때 정해 저장하고, 명단이 나중에 바뀌어도 그대로다. 학번이 비워진 명단 줄(빼기, 기한 지우기)은 맞지 않는다.
export async function appliedFeeOf(
  db: Pick<Db, 'select'>,
  target: { councilId: string; form: FormFees; studentId: string | null; now: Date },
): Promise<number> {
  const { payerFee, nonPayerFee } = target.form
  if (payerFee === nonPayerFee) return Number(payerFee ?? 0)
  // 두 값이 다르면 학번을 받는 양식이다. 그래도 학번이 없는 입력은 미납자로 본다(호출한 쪽이 이미 막는다).
  if (target.studentId === null) return Number(nonPayerFee)
  const today = koreanDateOf(target.now)
  const [paid] = await db
    .select({ id: feePayment.id })
    .from(feePayment)
    .where(
      and(
        eq(feePayment.councilId, target.councilId),
        eq(feePayment.studentId, target.studentId),
        lte(feePayment.paidFrom, today),
        gte(feePayment.paidUntil, today),
      ),
    )
    .limit(1)
  return Number(paid ? payerFee : nonPayerFee)
}
