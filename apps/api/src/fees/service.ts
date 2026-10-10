import { randomUUID } from 'node:crypto'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { DUES_ROSTER_USE_DAYS_MAX, FEE_ACCOUNT_HISTORY_MAX, type DeleteDuesRosterRequest, type FeeAccount, type FeeSettingsResponse,
  type ReplaceDuesRosterRequest, type SetFeeAccountRequest } from '@vada/contracts'
import { duesMembers, duesRosters, feeAccountEvents, feeAccounts, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { requireFinance } from '../purchases/review.js'
import { koreanToday, purgeExpiredRosters } from './roster.js'

type Db = PgDatabase<PgQueryResultHKT>
export type FeeDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'delete' | 'execute' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<FeeDatabase['transaction']>[0]>[0]
export interface FeeScope { organizationId: string; userId: string }
const updaters = alias(users, 'fee_account_updaters')
const actors = alias(users, 'fee_account_actors')
const uploaders = alias(users, 'dues_roster_uploaders')
// 납부자는 이만큼씩 나눠 넣는다(질의 하나의 매개변수 수 한도).
const INSERT_CHUNK = 1000

// 한국 날짜에 날을 더한다.
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const sameAccount = (a: FeeAccount, b: FeeAccount) => a.bank === b.bank && a.accountNumber === b.accountNumber && a.holder === b.holder

// 학생회 하나의 계좌·명단 변경을 한 줄로 세운다. advisory lock 키에는 학생회 ID만 쓴다.
async function lockFees(tx: Pick<Db, 'execute'>, organizationId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['fees', organizationId])}, 0))`)
}

async function settingsOf(db: Reader, organizationId: string): Promise<FeeSettingsResponse> {
  const [account] = await db.select({ account: feeAccounts, updaterName: updaters.name }).from(feeAccounts)
    .innerJoin(updaters, eq(updaters.id, feeAccounts.updatedBy)).where(eq(feeAccounts.organizationId, organizationId))
  const history = await db.select({ entry: feeAccountEvents, actorName: actors.name }).from(feeAccountEvents)
    .innerJoin(actors, eq(actors.id, feeAccountEvents.actorId)).where(eq(feeAccountEvents.organizationId, organizationId))
    .orderBy(desc(feeAccountEvents.createdAt), desc(feeAccountEvents.id)).limit(FEE_ACCOUNT_HISTORY_MAX)
  const [roster] = await db.select({ roster: duesRosters, uploaderName: uploaders.name }).from(duesRosters)
    .innerJoin(uploaders, eq(uploaders.id, duesRosters.uploadedBy)).where(eq(duesRosters.organizationId, organizationId))
  const members = roster ? await db.select({ studentId: duesMembers.studentId, name: duesMembers.name }).from(duesMembers)
    .where(eq(duesMembers.organizationId, organizationId)).orderBy(asc(duesMembers.studentId)) : []
  return {
    account: account ? { bank: account.account.bank, accountNumber: account.account.accountNumber, holder: account.account.holder,
      version: account.account.version, updatedAt: account.account.updatedAt.toISOString(),
      updatedBy: { id: account.account.updatedBy, name: account.updaterName } } : null,
    accountHistory: history.map(({ entry, actorName }) => ({ id: entry.id, actor: { id: entry.actorId, name: actorName },
      from: (entry.changes.from ?? null) as FeeAccount | null, to: entry.changes.to as FeeAccount, createdAt: entry.createdAt.toISOString() })),
    roster: roster ? { label: roster.roster.label, useUntil: roster.roster.useUntil, version: roster.roster.version,
      uploadedAt: roster.roster.uploadedAt.toISOString(), uploadedBy: { id: roster.roster.uploadedBy, name: roster.uploaderName }, members } : null,
  }
}

// 참가비 설정: 학생회 계좌와 학생회비 납부 명단. 재정 권한자만 보고 바꾼다.
export function createFeeService(db: FeeDatabase, now: () => Date) {
  // 바꾸기 전에: 재정 권한(부서 변경과 겹치지 않게 잠금) → 학생회 참가비 잠금 → 기한 지난 명단 지우기
  async function begin(tx: Transaction, scope: FeeScope) {
    await requireFinance(tx, scope, true)
    await lockFees(tx, scope.organizationId)
    await purgeExpiredRosters(tx, koreanToday(now()), scope.organizationId)
  }
  async function rosterVersion(tx: Transaction, scope: FeeScope) {
    const [row] = await tx.select({ version: duesRosters.version }).from(duesRosters).where(eq(duesRosters.organizationId, scope.organizationId))
    return row?.version ?? 0
  }
  return {
    // 읽기도 먼저 기한 지난 명단을 지운다. 그래서 응답에 나가지 않는다.
    settings: (scope: FeeScope) => db.transaction(async tx => {
      await requireFinance(tx, scope)
      await purgeExpiredRosters(tx, koreanToday(now()), scope.organizationId)
      return settingsOf(tx, scope.organizationId)
    }),
    // 바뀐 것이 없으면 버전과 기록을 그대로 둔다. 바뀌면 바꾸기 전과 뒤를 기록에 남긴다.
    setAccount: (scope: FeeScope, input: SetFeeAccountRequest) => db.transaction(async tx => {
      await begin(tx, scope)
      const [current] = await tx.select().from(feeAccounts).where(eq(feeAccounts.organizationId, scope.organizationId))
      if ((current?.version ?? 0) !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      const to: FeeAccount = { bank: input.bank, accountNumber: input.accountNumber, holder: input.holder }
      const from: FeeAccount | null = current ? { bank: current.bank, accountNumber: current.accountNumber, holder: current.holder } : null
      if (from && sameAccount(from, to)) return settingsOf(tx, scope.organizationId)
      if (current) {
        await tx.update(feeAccounts).set({ ...to, updatedBy: scope.userId, version: sql`${feeAccounts.version} + 1` })
          .where(eq(feeAccounts.organizationId, scope.organizationId))
      } else {
        await tx.insert(feeAccounts).values({ organizationId: scope.organizationId, ...to, updatedBy: scope.userId })
      }
      await tx.insert(feeAccountEvents).values({ id: randomUUID(), organizationId: scope.organizationId, actorId: scope.userId, changes: { from, to } })
      return settingsOf(tx, scope.organizationId)
    }),
    // 명단을 통째로 바꾼다. 쓰는 기한은 오늘(한국 날짜)부터 366일 안이다.
    replaceRoster: (scope: FeeScope, input: ReplaceDuesRosterRequest) => db.transaction(async tx => {
      await begin(tx, scope)
      const version = await rosterVersion(tx, scope)
      if (version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      const today = koreanToday(now())
      if (input.useUntil < today || input.useUntil > addDays(today, DUES_ROSTER_USE_DAYS_MAX)) throw new ApiError('USE_UNTIL_INVALID', 409)
      if (version) {
        await tx.delete(duesMembers).where(eq(duesMembers.organizationId, scope.organizationId))
        await tx.update(duesRosters).set({ label: input.label, useUntil: input.useUntil, uploadedBy: scope.userId, uploadedAt: sql`now()`,
          version: sql`${duesRosters.version} + 1` }).where(eq(duesRosters.organizationId, scope.organizationId))
      } else {
        await tx.insert(duesRosters).values({ organizationId: scope.organizationId, label: input.label, useUntil: input.useUntil, uploadedBy: scope.userId })
      }
      for (let start = 0; start < input.members.length; start += INSERT_CHUNK) {
        await tx.insert(duesMembers).values(input.members.slice(start, start + INSERT_CHUNK)
          .map(member => ({ organizationId: scope.organizationId, studentId: member.studentId, name: member.name })))
      }
      return settingsOf(tx, scope.organizationId)
    }),
    // 납부자는 FK CASCADE로 같이 지운다.
    deleteRoster: (scope: FeeScope, input: DeleteDuesRosterRequest) => db.transaction(async tx => {
      await begin(tx, scope)
      if (await rosterVersion(tx, scope) !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      await tx.delete(duesRosters).where(eq(duesRosters.organizationId, scope.organizationId))
      return settingsOf(tx, scope.organizationId)
    }),
  }
}
