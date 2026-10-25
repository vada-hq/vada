import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EVENT_LIST_LIMIT, SIDEBAR_EVENT_LIMIT, type SidebarEventsResponse } from '@vada/contracts'
import { createRecord } from '../records/records.js'
import { withEvents, type EventCouncil, type EventKit } from '../test-support/events.js'

// 'YYYY-MM-DDTHH:mm' 한국 시각
const korean = (value: string) => new Date(`${value}:00+09:00`)

async function sidebar(t: EventKit, user = 's-president') {
  const response = await t.api.get(`${t.base}/open`, user)
  assert.equal(response.status, 200)
  return (await response.json()) as SidebarEventsResponse
}

// 마지막 결재를 완료로 둔다(completion.ts와 같은 규칙).
const complete = (t: EventKit, id: string, owner: EventCouncil = t.council) =>
  t.db.transaction(tx =>
    createRecord(tx, {
      kind: 'approval',
      councilId: owner.councilId,
      actor: owner.people.president.memberId,
      values: {
        targetId: id,
        targetKind: 'event',
        outcome: 'completed',
        actorId: owner.people.president.memberId,
        actorKind: 'member',
        actedAt: korean('2026-10-20T10:00'),
      },
    }),
  )

// 지금은 한국 2026-10-25 12:00이다. 진행 중 둘, 예정 둘, 날짜 미정 둘, 끝남 하나와 완료 하나.
async function sevenOpen(t: EventKit, owner: EventCouncil = t.council) {
  const make = (values: Record<string, unknown>) => t.make(values, owner)
  await make({ name: '끝남', startsAt: korean('2026-10-01T10:00') })
  await make({ name: '미정 첫째' })
  await make({ name: '예정 먼 것', startsAt: korean('2026-12-01T10:00') })
  await make({ name: '진행 중 하나', startsAt: korean('2026-10-25T09:00') })
  await make({ name: '미정 둘째' })
  await make({ name: '예정 가까운 것', startsAt: korean('2026-10-26T10:00') })
  await make({ name: '진행 중 둘', startsAt: korean('2026-10-25T10:00') })
  await complete(t, await make({ name: '완료', startsAt: korean('2026-10-02T10:00') }), owner)
}

test(
  '옆 메뉴 행사는 완료하지 않은 것을 진행 중 → 예정 → 날짜 미정 → 끝남 차례로 5개까지 주고 더 있음을 알린다',
  withEvents(async t => {
    await sevenOpen(t)
    const { events, more } = await sidebar(t, 's-plain')
    assert.equal(SIDEBAR_EVENT_LIMIT, 5)
    assert.equal(more, true)
    assert.deepEqual(
      events.map(item => [item.name, item.status]),
      [
        ['진행 중 하나', 'ongoing'],
        ['진행 중 둘', 'ongoing'],
        ['예정 가까운 것', 'upcoming'],
        ['예정 먼 것', 'upcoming'],
        ['미정 첫째', 'tbd'],
      ],
    )
    // 칸은 id, 이름, 상태만이다(PRIN-5: 책임자·일시·장소·업무 수 없음).
    assert.deepEqual(Object.keys(events[0]!).sort(), ['id', 'name', 'status'])
  }),
)

test(
  '끝났고 완료하지 않은 행사는 들고 완료 행사는 없으며, 5개 이하면 더 있음이 아니다',
  withEvents(async t => {
    const ended = await t.make({ name: '끝남', startsAt: korean('2026-10-01T10:00') })
    await complete(t, await t.make({ name: '완료', startsAt: korean('2026-10-02T10:00') }))
    assert.deepEqual(await sidebar(t), {
      events: [{ id: ended, name: '끝남', status: 'ended' }],
      more: false,
    })
  }),
)

test(
  '행사가 없으면 빈 묶음이다',
  withEvents(async t => {
    assert.deepEqual(await sidebar(t), { events: [], more: false })
  }),
)

test(
  '완료 행사가 200개 넘게 있어도 가장 오래된 미완료 행사가 보인다',
  withEvents(async t => {
    const old = await t.make({ name: '오래된 미완료', startsAt: korean('2025-03-01T10:00') })
    await t.db.transaction(async tx => {
      for (let i = 0; i <= EVENT_LIST_LIMIT; i++) {
        const id = await createRecord(tx, {
          kind: 'event',
          councilId: t.council.councilId,
          actor: t.council.people.president.memberId,
          values: { name: `완료 ${i}`, startsAt: korean('2026-10-24T10:00') },
        })
        await createRecord(tx, {
          kind: 'approval',
          councilId: t.council.councilId,
          actor: t.council.people.president.memberId,
          values: {
            targetId: id,
            targetKind: 'event',
            outcome: 'completed',
            actorId: t.council.people.president.memberId,
            actorKind: 'member',
            actedAt: korean('2026-10-25T10:00'),
          },
        })
      }
    })
    // 행사 목록은 완료 행사를 섞어 200개에서 자르므로 이 행사가 없다.
    const list = await t.list()
    assert.equal(list.truncated, true)
    assert.equal(
      list.events.some(item => item.id === old),
      false,
    )
    assert.deepEqual(await sidebar(t), {
      events: [{ id: old, name: '오래된 미완료', status: 'ended' }],
      more: false,
    })
  }),
)

test(
  '다른 학생회 행사는 같은 이름·같은 상태라도 없다',
  withEvents(async t => {
    await sevenOpen(t, t.other)
    const ours = await t.make({ name: '끝남', startsAt: korean('2026-10-01T10:00') })
    assert.deepEqual(await sidebar(t), {
      events: [{ id: ours, name: '끝남', status: 'ended' }],
      more: false,
    })
  }),
)

test(
  '읽기는 401, 다른 학생회 사람과 내보낸 운영진은 403이다',
  withEvents(async t => {
    await t.make({})
    assert.equal((await t.api.get(`${t.base}/open`)).status, 401)
    for (const user of ['o-president', 's-ended'])
      assert.equal((await t.api.get(`${t.base}/open`, user)).status, 403, user)
  }),
)
