import {
  koreanDateOf,
  type AccountItem,
  type CreateAccountRequest,
  type UpdateAccountRequest,
} from '@vada/contracts'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { uniqueViolationOf } from '../db/error-code.js'
import { account } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRecord, updateRecord } from '../records/records.js'
import { assertAllowed } from './policy.js'
import { accountItemOf, accountRowOf } from './queries.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 권한표 → 계좌 행 읽기 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 학생회 행 잠금이 같은 학생회의 쓰기를 한 번에 하나로 줄 세우므로, 잠금 뒤에 읽은 이름과 대표 계좌가 이 거래가 끝날 때까지 바뀌지 않는다.
// 재정부만 쓴다(회장단도 403). 403이 다른 실패보다 먼저다. 다른 학생회 계좌는 없는 것과 같아 404다.

// 이름이 겹치는 계좌와 닫지 않은 대표 계좌는 미리 보고, 그 사이에 끼어든 쓰기는 DB의 유일 제약이 막는다(아래 guarded).
async function assertFree(tx: Tx, actor: Actor, wanted: CreateAccountRequest, selfId?: string) {
  const others = and(
    eq(account.councilId, actor.councilId),
    selfId ? ne(account.id, selfId) : undefined,
  )
  const [named] = await tx
    .select({ id: account.id })
    .from(account)
    .where(and(others, eq(account.name, wanted.name)))
  if (named) throw new ApiError('ACCOUNT_NAME_TAKEN')
  if (wanted.type !== 'main') return
  const [main] = await tx
    .select({ id: account.id })
    .from(account)
    .where(and(others, eq(account.type, 'main'), sql`${account.closedOn} is null`))
  if (main) throw new ApiError('MAIN_ACCOUNT_EXISTS')
}

// 유일 제약 위반을 오류 코드로 바꾼다. 이름 제약이 아니면 닫지 않은 대표 계좌 인덱스다.
const NAME_CONSTRAINT = 'account_council_id_name_key'
async function guarded<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    const constraint = uniqueViolationOf(error)
    if (!constraint) throw error
    throw new ApiError(
      constraint === NAME_CONSTRAINT ? 'ACCOUNT_NAME_TAKEN' : 'MAIN_ACCOUNT_EXISTS',
    )
  }
}

export async function createAccount(
  tx: Tx,
  actor: Actor,
  input: CreateAccountRequest,
): Promise<AccountItem> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  await assertFree(tx, actor, input)
  const id = await guarded(() =>
    createRecord(tx, {
      kind: 'account',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: input,
    }),
  )
  return accountItemOf(tx, actor, id)
}

// 닫은 계좌는 고치지 않는다. 같은 값이면 판을 만들지 않는다.
export async function updateAccount(
  tx: Tx,
  actor: Actor,
  accountId: string,
  input: UpdateAccountRequest,
): Promise<AccountItem> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await accountRowOf(tx, actor, accountId)
  await assertAllowed(tx, actor, row, 'account.update')
  await assertFree(tx, actor, input, row.id)
  const changes = {
    ...(input.name !== row.name ? { name: input.name } : {}),
    ...(input.bank !== row.bank ? { bank: input.bank } : {}),
    ...(input.accountNumber !== row.accountNumber ? { accountNumber: input.accountNumber } : {}),
    ...(input.holder !== row.holder ? { holder: input.holder } : {}),
    ...(input.type !== row.type ? { type: input.type } : {}),
  }
  if (Object.keys(changes).length)
    await guarded(() =>
      updateRecord(tx, {
        kind: 'account',
        id: row.id,
        actor: actor.memberId,
        reason: null,
        changes,
      }),
    )
  return accountItemOf(tx, actor, row.id)
}

// 닫으면 닫은 날(한국 오늘)이 남고 다시 열지 않는다. 이미 닫았으면 ACCOUNT_CLOSED, 완료 전 행사의 신청 양식이 쓰면 ACCOUNT_IN_USE(409)다.
export async function closeAccount(
  tx: Tx,
  actor: Actor,
  target: { accountId: string; now: Date },
): Promise<AccountItem> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await accountRowOf(tx, actor, target.accountId)
  await assertAllowed(tx, actor, row, 'account.close')
  await updateRecord(tx, {
    kind: 'account',
    id: row.id,
    actor: actor.memberId,
    reason: null,
    changes: { closedOn: koreanDateOf(target.now) },
  })
  return accountItemOf(tx, actor, row.id)
}
