import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EVENT_ACTIONS, type EventAction, type EventDetail } from '@vada/contracts'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 행사 정책의 구조 검사(기능 012 조각 6, work-method '검사와 시험'): 상태 × 사람 × EVENT_ACTIONS 표.
// 칸마다 읽기 actions에 있으면 그 쓰기가 성공하고, 없으면 403이나 그 칸의 코드로 거절된다(blockers에 오른 코드는 쓰기의 코드와 같다).
// 동작이나 상태를 더하면 이 표에 줄을 더한다. 예외 목록은 없다.

const PEOPLE = { 회장단: 's-president', 책임자: 's-planningMember', 다른_운영진: 's-planningHead' }
type Person = keyof typeof PEOPLE
type Cells = Record<EventAction, string | null>
type Rows = Record<Person, Cells>

const FORBIDDEN = 'FORBIDDEN'
const cells = (update: string | null, complete: string | null, cancel: string | null): Cells => ({
  'event.update': update,
  'event.complete': complete,
  'event.cancel_completion': cancel,
})
const denied = cells(FORBIDDEN, FORBIDDEN, FORBIDDEN)
// 책임자는 고치기만 하고 완료·완료 취소는 회장단이다(DEC-39, DEC-79).
const rows = (president: Cells): Rows => ({
  회장단: president,
  책임자: cells(president['event.update'], FORBIDDEN, FORBIDDEN),
  다른_운영진: denied,
})

// 쓰기 요청. 동작 하나마다 한 칸이라, 목록에 동작을 더하면 여기도 더해야 한다.
const WRITE: Record<EventAction, (id: string, versionNo: number) => [string, unknown]> = {
  'event.update': (id, baseVersionNo) => [
    id,
    { name: '바뀐 이름', startsAt: null, endsAt: null, place: null, baseVersionNo },
  ],
  'event.complete': id => [`${id}/complete`, {}],
  'event.cancel_completion': id => [`${id}/cancel-completion`, { reason: '되돌림' }],
}

type State = {
  name: string
  expected: Rows
  build: (t: SettlementKit, owner: string) => Promise<string>
}

const plain =
  (values: Record<string, unknown> = {}) =>
  (t: SettlementKit, owner: string) =>
    t.event({ ownerId: owner, ...values })
const notEnded = (code: string) => rows(cells(null, code, 'EVENT_NOT_COMPLETED'))

// 참가비 입금이 있는 끝난 행사. 수입이 들어갈 회계 기간은 표를 다 만든 뒤에 공개한다.
async function withFee(t: SettlementKit, owner: string, period: { id: string | null }) {
  period.id ??= (await t.budgetOf()).period
  const event = await t.event({ ownerId: owner })
  await t.deposit(await t.registration(await t.form(event)), {
    confirmedAt: new Date('2026-10-21T03:00:00Z'),
  })
  return event
}

const STATES = (period: { id: string | null }): State[] => [
  { name: '미정', expected: notEnded('EVENT_NOT_ENDED'), build: plain({ startsAt: null }) },
  {
    name: '예정',
    expected: notEnded('EVENT_NOT_ENDED'),
    build: plain({ startsAt: new Date('2026-11-01T00:00:00Z') }),
  },
  {
    name: '진행 중',
    expected: notEnded('EVENT_NOT_ENDED'),
    build: plain({
      startsAt: new Date('2026-10-24T00:00:00Z'),
      endsAt: new Date('2026-10-26T00:00:00Z'),
    }),
  },
  {
    name: '끝남, 남은 것 있음',
    expected: notEnded('SETTLEMENT_PENDING'),
    build: async (t, owner) => {
      const id = await t.event({ ownerId: owner })
      await t.requestWithItem(id)
      return id
    },
  },
  {
    name: '끝남, 정산 끝',
    expected: rows(cells(null, null, 'EVENT_NOT_COMPLETED')),
    build: plain(),
  },
  {
    name: '끝남, 수입 기간 공개',
    expected: notEnded('PERIOD_CLOSED'),
    build: (t, owner) => withFee(t, owner, period),
  },
  {
    name: '완료',
    expected: rows(cells('EVENT_COMPLETED', 'EVENT_COMPLETED', null)),
    build: async (t, owner) => {
      const id = await t.event({ ownerId: owner })
      await t.completion(id, 'completed', new Date('2026-10-24T03:00:00Z'))
      return id
    },
  },
  {
    name: '완료, 수입 기간 공개',
    expected: rows(cells('EVENT_COMPLETED', 'EVENT_COMPLETED', 'PERIOD_CLOSED')),
    // 기간을 공개하기 전에 실제 경로로 완료해야 참가비 수입이 기간에 든다.
    build: async (t, owner) => {
      const id = await withFee(t, owner, period)
      const response = await t.api.post(`${t.base}/${id}/complete`, {}, PEOPLE.회장단)
      assert.equal(response.status, 200)
      return id
    },
  },
]

// 풀 수 있는 막힘만 blockers에 오른다. 권한, 이미 완료, 완료한 행사가 아님은 막힌 이유가 아니다.
const NOT_BLOCKERS = [null, FORBIDDEN, 'EVENT_COMPLETED', 'EVENT_NOT_COMPLETED']

test(
  '상태 × 사람 × 동작: 읽기 actions에 있으면 쓰기가 성공하고, 없으면 403이나 그 칸의 코드로 거절된다',
  withSettlement(async t => {
    assert.deepEqual(Object.keys(WRITE).sort(), [...EVENT_ACTIONS].sort(), '표 열이 목록과 다르다')
    const period = { id: null as string | null }
    const owner = t.council.people.planningMember.memberId
    // 칸마다 새 행사가 필요해(성공한 쓰기가 상태를 바꾼다) 모두 만든 뒤에 기간을 공개한다.
    const built = new Map<string, string>()
    const states = STATES(period)
    for (const state of states)
      for (const person of Object.keys(PEOPLE) as Person[])
        for (const action of EVENT_ACTIONS)
          built.set(`${state.name}/${person}/${action}`, await state.build(t, owner))
    assert.ok(period.id)
    await t.make(t.council, 'account_closing', {
      fiscalPeriodId: period.id,
      publishedAt: new Date('2026-10-25T00:00:00Z'),
    })
    for (const state of states)
      for (const person of Object.keys(PEOPLE) as Person[])
        for (const action of EVENT_ACTIONS) {
          const cell = `${state.name} ${person} ${action}`
          const id = built.get(`${state.name}/${person}/${action}`)!
          const user = PEOPLE[person]
          const read = (await (await t.api.get(`${t.base}/${id}`, user)).json()) as {
            event: EventDetail
          }
          const expected = state.expected[person][action]
          assert.equal(read.event.actions.includes(action), expected === null, `${cell} actions`)
          assert.equal(
            read.event.blockers[action as keyof EventDetail['blockers']],
            NOT_BLOCKERS.includes(expected) ? undefined : expected,
            `${cell} blockers`,
          )
          // 되는 칸은 읽은 판으로 보낸다. 안 되는 칸은 낡은 판으로 보내도 표의 코드가 먼저여야 한다(권한·상태 거절이 409보다 앞선다).
          const version = read.event.versionNo + (expected === null ? 0 : 1)
          const [path, body] = WRITE[action](id, version)
          const response = await t.api.post(`${t.base}/${path}`, body, user)
          const code = response.ok ? null : ((await response.json()) as { error: string }).error
          assert.equal(code, expected, `${cell} 쓰기`)
        }
  }),
)
