import { createHmac } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { commandReceipt } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { uniqueViolationOf } from '../db/error-code.js'
import { idList } from '../registrations/personal-values.js'

// 명령 영수증(기능 017, DEC-84, RULE-45): 같은 명령 번호의 재전송에 처음 결과를 돌려주려고 남긴다. 기록(record)이 아니다.
// 본문 해시는 신청 본문(이름·학번·휴대폰)에서 나온 가명 정보라 로그·오류·응답에 넣지 않고 24시간 뒤 지운다.
const HOURS = 24
const MS_PER_HOUR = 3_600_000
const RECEIPT_TTL_MS = HOURS * MS_PER_HOUR

export type ReceiptKey = {
  kind: 'registration_apply' | 'expense_create'
  // 같은 번호도 범위가 다르면 따로 센다: 신청은 양식 번호, 지출은 '학생회 번호:보낸 운영진 번호'
  scopeKey: string
  commandId: string
}

// 번호를 뺀 본문의 HMAC(서버 비밀 값 키). 소금 없는 해시는 이름·휴대폰 목록으로 되돌릴 수 있어 쓰지 않는다.
// 칸 사이를 JSON으로 갈라 '가나'+'다'와 '가'+'나다'가 같아지지 않는다.
export const bodyHashOf = (secret: string, parts: readonly (string | null)[]) =>
  createHmac('sha256', secret).update(JSON.stringify(parts)).digest('hex')

const matches = (key: ReceiptKey) =>
  and(
    eq(commandReceipt.kind, key.kind),
    eq(commandReceipt.scopeKey, key.scopeKey),
    eq(commandReceipt.commandId, key.commandId),
  )

// 지금 쓸 수 있는 영수증. 24시간이 지난 것은 지우기 일이 오기 전이어도 새 명령으로 보려고 지우고 없는 것으로 돌려준다.
// 부르는 쪽이 만드는 거래의 잠금(양식 행, 학생회 행)을 먼저 잡아야 겹친 두 요청이 하나만 만든다.
export async function receiptOf(tx: Tx, key: ReceiptKey, now: Date) {
  const [found] = await tx.select().from(commandReceipt).where(matches(key))
  if (!found) return undefined
  if (now.getTime() - found.createdAt.getTime() >= RECEIPT_TTL_MS) {
    await dropReceipt(tx, key)
    return undefined
  }
  return { resultId: found.resultId, bodyHash: found.bodyHash }
}

export async function dropReceipt(tx: Tx, key: ReceiptKey) {
  await tx.delete(commandReceipt).where(matches(key))
}

// 만든 결과와 같은 거래에서 남긴다. 검사·권한·상태로 거절하면 거래가 물러나 영수증도 없어 고쳐서 다시 보낼 수 있다.
export async function saveReceipt(
  tx: Tx,
  key: ReceiptKey,
  saved: { bodyHash: string; resultId: string; resultKind: 'registration' | 'expense' },
  now: Date,
) {
  try {
    await tx.insert(commandReceipt).values({ ...key, ...saved, createdAt: now })
  } catch (error) {
    // 잠금이 틀려 같은 명령 둘이 겹쳐도 UNIQUE가 하나만 남긴다. 500이 아니라 정한 코드로 돌려주고 거래는 물러난다.
    if (uniqueViolationOf(error)) throw new ApiError('COMMAND_CONFLICT')
    throw error
  }
}

// 신청을 취소하거나 신청자 정보를 비울 때 그 신청의 영수증도 바로 지운다(DEC-44, DEC-55). 본문 해시도 신청 본문에서 나온 값이다.
export async function removeReceiptsOf(tx: Pick<Tx, 'execute'>, resultIds: string[]) {
  await tx.execute(sql`DELETE FROM command_receipt WHERE result_id IN ${idList(resultIds)}`)
}

// 24시간이 지난 영수증을 지운다. 같은 일을 두 번 해도 같다.
export async function purgeReceipts(tx: Tx, now: Date) {
  await tx.execute(
    sql`DELETE FROM command_receipt WHERE created_at <= (${now.toISOString()}::timestamptz - interval '24 hours')`,
  )
}
