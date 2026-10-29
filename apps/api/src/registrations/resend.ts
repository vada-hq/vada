import { and, eq, isNull, isNotNull } from 'drizzle-orm'
import type { ApplyRequest } from '@vada/contracts'
import { bodyHashOf, dropReceipt, receiptOf, type ReceiptKey } from '../commands/receipt.js'
import { registration } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { newToken, replaceLink } from './link.js'
import { lockRegistration } from './registration-lock.js'

export const applyKeyOf = (formId: string, commandId: string): ReceiptKey => ({
  kind: 'registration_apply',
  scopeKey: formId,
  commandId,
})

// 신청 본문(번호는 뺀다)의 해시. 휴대폰은 계약이 이미 공백과 -를 뺀 값이다.
// 답은 있을 때만 더한다. 질문 없는 신청의 해시가 그대로여서 배포 전에 받은 영수증의 재전송도 같은 신청이다.
export const applyBodyHashOf = (
  secret: string,
  input: Pick<ApplyRequest, 'name' | 'studentId' | 'phone' | 'answers'>,
) =>
  bodyHashOf(secret, [
    input.name,
    input.studentId,
    input.phone,
    ...(input.answers.length ? [JSON.stringify(input.answers)] : []),
  ])

// 이 번호의 신청이 이미 있으면 새 신청을 만들지 않고 같은 신청에 새 개인 링크를 준다(DEC-84).
// 같은 번호에 다른 본문은 COMMAND_REUSED이고 아무것도 바꾸지 않는다. 신청이 그사이 취소됐으면 영수증을 버려 새 신청으로 받는다(undefined).
// 양식 행을 잠근 뒤에 불러야 겹친 같은 명령 둘 중 나중 것이 앞의 영수증을 본다.
export async function resendApply(
  tx: Tx,
  key: ReceiptKey,
  bodyHash: string,
  now: Date,
): Promise<{ token: string } | undefined> {
  const receipt = await receiptOf(tx, key, now)
  if (!receipt) return undefined
  if (receipt.bodyHash !== bodyHash) throw new ApiError('COMMAND_REUSED')
  // 취소와 겹쳐도 하나만 되게 신청 행을 잠근 뒤 다시 읽는다. 취소하면 이름이 비어 있다.
  await lockRegistration(tx, receipt.resultId)
  const [live] = await tx
    .select({ id: registration.id })
    .from(registration)
    .where(
      and(
        eq(registration.id, receipt.resultId),
        isNull(registration.cancelledAt),
        isNotNull(registration.name),
      ),
    )
  if (!live) {
    await dropReceipt(tx, key)
    return undefined
  }
  // DB에는 해시만 있어 처음 토큰을 다시 줄 수 없다. 신청 하나에 링크 한 줄이라 앞 토큰은 닫힌다.
  const token = newToken()
  await replaceLink(tx, live.id, token)
  return { token }
}
