import { and, asc, desc, eq, sql } from 'drizzle-orm'
import {
  ACCOUNT_ACTIONS,
  ACCOUNT_LIST_LIMIT,
  type AccountItem,
  type AccountType,
  type AccountsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { account } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<Db, 'select'>

const accountSelect = (db: Reader) =>
  db
    .select({
      id: account.id,
      name: account.name,
      bank: account.bank,
      accountNumber: account.accountNumber,
      holder: account.holder,
      type: account.type,
      closedOn: account.closedOn,
    })
    .from(account)
type Row = Awaited<ReturnType<ReturnType<typeof accountSelect>['where']>>[number]

// 닫은 계좌는 고치거나 닫을 수 없으므로 동작이 없다.
const itemOf = (actor: Actor, row: Row): AccountItem => ({
  ...row,
  type: row.type as AccountType,
  actions: row.closedOn === null ? ACCOUNT_ACTIONS.filter(action => can(actor, action)) : [],
})

// 이 학생회의 계좌 하나. 다른 학생회 계좌는 없는 것과 같아 404다.
export async function accountRowOf(db: Reader, actor: Actor, accountId: string) {
  const [row] = await accountSelect(db).where(
    and(eq(account.councilId, actor.councilId), eq(account.id, accountId)),
  )
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

export async function accountItemOf(db: Reader, actor: Actor, accountId: string) {
  return itemOf(actor, await accountRowOf(db, actor, accountId))
}

// 닫지 않은 계좌(대표 먼저, 이름 순) 뒤에 닫은 계좌(최근에 닫은 순). 한 개 더 읽어 넘쳤는지 안다.
export async function accountListOf(db: Reader, actor: Actor): Promise<AccountsResponse> {
  const open = sql`${account.closedOn} is null`
  const rows = await accountSelect(db)
    .where(eq(account.councilId, actor.councilId))
    .orderBy(
      sql`case when ${open} then 0 else 1 end`,
      sql`case when ${open} and ${account.type} = 'main' then 0 else 1 end`,
      asc(sql`case when ${open} then ${account.name} end`),
      desc(account.closedOn),
      asc(account.id),
    )
    .limit(ACCOUNT_LIST_LIMIT + 1)
  return {
    accounts: rows.slice(0, ACCOUNT_LIST_LIMIT).map(row => itemOf(actor, row)),
    truncated: rows.length > ACCOUNT_LIST_LIMIT,
  }
}

// 지출에 쓸 수 있는 계좌: 이 학생회의 닫지 않은 계좌. 아니면 ACCOUNT_INVALID다.
export async function assertUsableAccount(db: Reader, actor: Actor, accountId: string) {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.id, accountId),
        eq(account.councilId, actor.councilId),
        sql`${account.closedOn} is null`,
      ),
    )
  if (!row) throw new ApiError('ACCOUNT_INVALID')
}
