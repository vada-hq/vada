import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACCOUNT_ACTIONS, type AccountAction, type AccountItem } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { BODY, withAccounts, type AccountKit } from '../test-support/accounts.js'
import { decide } from './policy.js'

// 계좌 정책(기능 014 조각 7): 상태 × 사람 × ACCOUNT_ACTIONS 표. 칸마다 읽기 actions에 있으면 그 쓰기가 성공하고,
// 없으면 칸의 코드로 거절된다. 동작이나 상태를 더하면 줄을 더한다. 예외 목록은 없다.

const FORBIDDEN = 'FORBIDDEN'
const CLOSED = 'ACCOUNT_CLOSED'
const IN_USE = 'ACCOUNT_IN_USE'
const PEOPLE = { 재정부: 's-financeMember', 회장단: 's-president', 직급_없는_운영진: 's-plain' }

type Cells = Record<AccountAction, string | null>
const cells = (update: string | null, close: string | null): Cells => ({
  'account.update': update,
  'account.close': close,
})

// 표는 칸마다 계좌를 새로 만들므로 이름이 겹치지 않게 한다.
let named = 0
const fresh = (t: AccountKit) => t.make({ name: `통장 ${named++}` })

type State = { name: string; expected: Cells; build: (t: AccountKit) => Promise<string> }
const STATES: State[] = [
  { name: '쓰는 양식 없음', expected: cells(null, null), build: t => fresh(t) },
  {
    name: '완료 전 행사의 양식이 씀',
    expected: cells(null, IN_USE),
    build: async t => {
      const id = await fresh(t)
      await t.form(await t.event(), id)
      return id
    },
  },
  {
    name: '마감한 양식도 씀',
    expected: cells(null, IN_USE),
    build: async t => {
      const id = await fresh(t)
      await t.form(await t.event(), id, { closesAt: new Date('2026-10-01T00:00:00Z') })
      return id
    },
  },
  {
    name: '멈춘 양식도 씀',
    expected: cells(null, IN_USE),
    build: async t => {
      const id = await fresh(t)
      await t.form(await t.event(), id, { pausedAt: new Date('2026-10-20T00:00:00Z') })
      return id
    },
  },
  {
    name: '완료한 행사의 양식만 씀',
    expected: cells(null, null),
    build: async t => {
      const id = await fresh(t)
      const event = await t.event()
      await t.form(event, id)
      await t.complete(event)
      return id
    },
  },
  {
    name: '닫은 계좌',
    expected: cells(CLOSED, CLOSED),
    build: async t => {
      const id = await fresh(t)
      await t.change(id, { closedOn: '2026-10-01' })
      return id
    },
  },
]

const WRITE: Record<AccountAction, (id: string) => [string, unknown]> = {
  'account.update': id => [`/${id}`, { ...BODY, name: '바뀐 이름' }],
  'account.close': id => [`/${id}/close`, {}],
}

const itemOf = async (t: AccountKit, id: string, user: string) =>
  (await t.list(user)).body.accounts.find(item => item.id === id) as AccountItem

for (const state of STATES)
  test(
    `계좌 정책 표: ${state.name}`,
    withAccounts(async t => {
      for (const [person, user] of Object.entries(PEOPLE))
        for (const action of ACCOUNT_ACTIONS) {
          const id = await state.build(t)
          const expected = person === '재정부' ? state.expected[action] : FORBIDDEN
          const shown = (await itemOf(t, id, user)).actions.includes(action)
          assert.equal(shown, expected === null, `${person} ${action} 읽기`)
          const [path, body] = WRITE[action](id)
          const response = await t.post(path, body, user)
          if (expected === null) assert.equal(response.status, 200, `${person} ${action} 쓰기`)
          else
            assert.equal(
              ((await response.json()) as { error: string }).error,
              expected,
              `${person} ${action} 쓰기`,
            )
        }
    }),
  )

test(
  '쓰는 중이면 사용 양식 수가 실리고 닫히지 않으며, 양식을 옮기거나 행사를 완료하면 닫힌다',
  withAccounts(async t => {
    const a = await t.make({})
    const b = await t.make({ name: '다른 통장' })
    const first = await t.event()
    const second = await t.event()
    const formA = await t.form(first, a)
    await t.form(second, a)
    assert.equal((await itemOf(t, a, 's-financeMember')).formsInUse, 2)
    assert.equal((await t.post(`/${a}/close`, {})).status, 409)
    assert.equal(await t.count('SELECT count(*) AS n FROM account WHERE closed_on IS NOT NULL'), 0)
    await t.changeRecord('registration_form', formA, { feeAccountId: b })
    await t.complete(second)
    assert.equal((await itemOf(t, a, 's-financeMember')).formsInUse, 0)
    assert.equal((await t.post(`/${a}/close`, {})).status, 200)
  }),
)

test(
  '다른 학생회 양식은 세지 않는다',
  withAccounts(async t => {
    const mine = await t.make({})
    const theirs = await t.make({}, t.other)
    const foreign = await t.form(await t.event(t.other), theirs, {}, t.other)
    // 기록 모듈은 다른 학생회 계좌를 가리키지 못하게 막으므로, 같은 값으로 SQL에서 바꾼다.
    await t.pg.query('UPDATE registration_form SET fee_account_id = $1 WHERE id = $2', [
      mine,
      foreign,
    ])
    assert.equal((await itemOf(t, mine, 's-financeMember')).formsInUse, 0)
    assert.equal((await t.post(`/${mine}/close`, {})).status, 200)
  }),
)

test(
  '읽지 않은 사실로는 닫기가 막힌다',
  withAccounts(async t => {
    const actor = await actorOf(t.db, 's-financeMember', t.council.councilId, new Date())
    assert.ok(actor)
    assert.equal(
      decide(actor, { closed: false, formsInUse: null }, 'account.close'),
      'ACCOUNT_IN_USE',
    )
    assert.equal(decide(actor, { closed: false, formsInUse: 0 }, 'account.close'), null)
  }),
)
