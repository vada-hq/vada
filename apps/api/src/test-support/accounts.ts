import type { AccountItem, AccountsResponse, ExpenseDetail } from '@vada/contracts'
import { createAccountRoutes } from '../accounts/routes.js'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createExpenseRoutes } from '../expenses/routes.js'
import { createRecord, updateRecord } from '../records/records.js'
import { seedCouncil } from './council.js'
import { caller, ORIGIN, testSession } from './http.js'

// 한국 시각 2026-10-25 12:00
const NOON = new Date('2026-10-25T03:00:00Z')
export const MISSING = '019e0000-0000-7000-8000-000000000000'
const FINANCE = 's-financeMember'

export const BODY = {
  name: '운영비',
  bank: '국민은행',
  accountNumber: '123-45-6789012',
  holder: '한양대 학생회',
  type: 'business',
}
type Values = Record<string, unknown>

// 학생회 둘(우리, 다른)과 계좌, 지출 라우트를 띄운다.
async function startAccounts() {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  let now = NOON
  const clock = () => now
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      accounts: createAccountRoutes(db, testSession, { clock }),
      expenses: createExpenseRoutes(db, testSession, { clock, receiptKey: 'test-receipt-key' }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/accounts`
  const expensesBase = `/api/organizations/${council.councilId}/expenses`
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  const make = (values: Values, owner: typeof council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'account',
        councilId: owner.councilId,
        actor: owner.people.financeMember.memberId,
        values: { ...BODY, ...values },
      }),
    )
  const change = (id: string, changes: Values) =>
    db.transaction(tx =>
      updateRecord(tx, {
        kind: 'account',
        id,
        actor: council.people.financeMember.memberId,
        reason: null,
        changes,
      }),
    )
  // 신청 양식이 참가비 받는 계좌로 가리키는 계좌 시험용: 행사, 그 행사의 완료, 양식을 기록 모듈로 만든다.
  const recordOf = (kind: string, values: Values, owner: typeof council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind,
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values,
      } as Parameters<typeof createRecord>[1]),
    )
  const event = (owner: typeof council = council) =>
    recordOf('event', { name: '봄 축제', startsAt: new Date('2026-11-20T00:00:00Z') }, owner)
  const complete = (eventId: string) =>
    recordOf('approval', {
      targetId: eventId,
      targetKind: 'event',
      outcome: 'completed',
      actorId: council.people.president.memberId,
      actorKind: 'member',
      actedAt: NOON,
      reason: null,
    })
  let codes = 0
  const form = (eventId: string, accountId: string, values: Values = {}, owner = council) =>
    recordOf(
      'registration_form',
      {
        eventId,
        name: '신청',
        closesAt: new Date('2026-11-01T09:00:00Z'),
        publicCode: `CCCCCC${'23456789'[Math.floor(codes / 8) % 8]}${'23456789'[codes++ % 8]}`,
        payerFee: '5000',
        nonPayerFee: '5000',
        feeAccountId: accountId,
        ...values,
      },
      owner,
    )
  const changeRecord = (kind: string, id: string, changes: Values) =>
    db.transaction(tx =>
      updateRecord(tx, {
        kind,
        id,
        actor: council.people.president.memberId,
        reason: null,
        changes,
      } as Parameters<typeof updateRecord>[1]),
    )
  const post = (path: string, body: unknown, user = FINANCE) =>
    api.post(`${base}${path}`, body, user)
  const list = async (user = FINANCE) => {
    const response = await api.get(base, user)
    return { status: response.status, response, body: (await response.json()) as AccountsResponse }
  }
  const created = async (values: Values = {}, user = FINANCE) => {
    const response = await post('', { ...BODY, ...values }, user)
    return {
      status: response.status,
      account: ((await response.json()) as { account?: AccountItem }).account,
    }
  }
  const spend = async (body: Values = {}, user = FINANCE) => {
    const response = await api.post(
      expensesBase,
      {
        method: 'card',
        vendor: '다이소',
        description: '마커',
        amount: 5000,
        paidOn: '2026-10-25',
        ...body,
      },
      user,
    )
    const copy = response.clone()
    return {
      status: response.status,
      expense: ((await response.json()) as { expense?: ExpenseDetail }).expense,
      response: copy,
    }
  }
  const expenseDetail = async (id: string, user = FINANCE) =>
    ((await (await api.get(`${expensesBase}/${id}`, user)).json()) as { expense: ExpenseDetail })
      .expense
  return {
    pg,
    db,
    council,
    other,
    api,
    base,
    make,
    change,
    recordOf,
    changeRecord,
    event,
    complete,
    form,
    post,
    list,
    created,
    spend,
    expenseDetail,
    count,
    accountCount: () => count('SELECT count(*) AS n FROM account'),
    versions: (id: string) =>
      count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id]),
    setNow: (value: Date) => {
      now = value
    },
    close,
  }
}
export type AccountKit = Awaited<ReturnType<typeof startAccounts>>

export const withAccounts = (body: (t: AccountKit) => Promise<void>) => async () => {
  const t = await startAccounts()
  try {
    await body(t)
  } finally {
    await t.close()
  }
}
