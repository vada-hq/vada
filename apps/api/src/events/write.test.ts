import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  codePoints,
  dateFromKorean,
  EVENT_NAME_MAX,
  EVENT_PLACE_MAX,
  type EventDetail,
} from '@vada/contracts'
import { removeMember } from '../team/service.js'
import { createRateLimiter } from '../http/rate-limit.js'
import { inCouncilChange } from '../access/authorize.js'
import { MISSING, NOON, startEvents, withEvents, type EventKit } from '../test-support/events.js'

const FULL = {
  name: '가을 축제',
  startsAt: '2026-11-05T14:00',
  endsAt: '2026-11-05T18:00',
  place: '대운동장',
}
const created = async (response: Response) => {
  assert.equal(response.status, 201)
  return ((await response.json()) as { event: EventDetail }).event
}
// 남이 책임자인 행사. 만들기 요청은 책임자를 받지 않으므로(만든 사람이 책임자, DEC-79) 고치기 시험은 기록을 바로 만든다.
const ownedBy = async (t: EventKit, ownerId: string) => ({
  id: await t.make({
    name: FULL.name,
    startsAt: dateFromKorean(FULL.startsAt),
    endsAt: dateFromKorean(FULL.endsAt),
    place: FULL.place,
    ownerId,
  }),
})

test(
  '회장단이 행사를 만들면 판 1이 열리고 만든 사람이 책임자이며 일시가 한국 시각으로 보인다',
  withEvents(async t => {
    const owner = t.council.people.president.memberId
    const event = await created(await t.post('', FULL))
    assert.equal(event.name, '가을 축제')
    assert.equal(event.startsAt, '2026-11-05T14:00')
    assert.equal(event.endsAt, '2026-11-05T18:00')
    assert.equal(event.place, '대운동장')
    assert.deepEqual(event.owner, { id: owner, name: 's president', current: true })
    assert.equal(event.status, 'upcoming')
    assert.deepEqual(event.tasks, { open: 0, total: 0 })
    assert.deepEqual(
      event.history.map(v => v.changes),
      [[{ field: 'created' }]],
    )
    assert.equal(await t.versions(event.id), 1)
    // 회장단은 책임자가 아니어도 고친다(DEC-79). 예정 행사는 완료할 수 없다.
    assert.deepEqual(event.actions, ['event.update'])
    assert.deepEqual(event.blockers, { 'event.complete': 'EVENT_NOT_ENDED' })
  }),
)

test(
  '이름만으로도 만들고 부회장도 만든다. 일시와 장소는 비어 있고 책임자는 부회장이다',
  withEvents(async t => {
    const event = await created(await t.post('', { name: '  뒤풀이  ' }, 's-vicePresident'))
    assert.equal(event.name, '뒤풀이')
    assert.deepEqual([event.startsAt, event.endsAt, event.place], [null, null, null])
    assert.equal(event.owner?.id, t.council.people.vicePresident.memberId)
    assert.equal(event.status, 'tbd')
  }),
)

test(
  '부장과 부부장도 만들고 만든 사람이 책임자라 그 행사를 고친다(DEC-93)',
  withEvents(async t => {
    const made: Record<string, string> = {}
    for (const name of ['planningHead', 'planningViceHead'] as const) {
      const person = t.council.people[name]
      const event = await created(await t.post('', FULL, person.userId))
      assert.deepEqual(event.owner, { id: person.memberId, name: `s ${name}`, current: true })
      assert.equal(event.history[0]?.by?.id, person.memberId)
      assert.deepEqual(event.actions, ['event.update'])
      const edit = await t.post(`/${event.id}`, { ...FULL, place: '강당' }, person.userId)
      assert.equal(edit.status, 200, name)
      made[name] = event.id
    }
    // 같은 부서의 다른 부서장이 만든 행사는 책임자가 아니라 고치지 못한다.
    assert.equal((await t.post(`/${made.planningHead}`, FULL, 's-planningViceHead')).status, 403)
  }),
)

test(
  '부원, 직급 없는 운영진, 재정부원은 만들 수 없고 아무것도 남지 않는다',
  withEvents(async t => {
    for (const user of ['s-planningMember', 's-plain', 's-financeMember'])
      assert.equal((await t.post('', FULL, user)).status, 403, user)
    assert.equal(await t.eventCount(), 0)
    assert.equal(await t.count("SELECT count(*) AS n FROM record WHERE kind = 'event'"), 0)
  }),
)

test(
  '로그인하지 않으면 401, 다른 학생회 회장단·부서장과 내보낸 운영진은 403이다',
  withEvents(async t => {
    assert.equal((await t.api.post(t.base, FULL)).status, 401)
    for (const user of ['o-president', 'o-planningHead', 'o-planningViceHead'])
      assert.equal((await t.post('', FULL, user)).status, 403, user)
    assert.equal((await t.post('', FULL, 's-ended')).status, 403)
    assert.equal(await t.eventCount(), 0)
  }),
)

test(
  '책임자는 받지 않는다: ownerId를 보내면 자기 번호든 남의 번호든 null이든 400이고 아무것도 남지 않는다',
  withEvents(async t => {
    const { people } = t.council
    for (const [user, ownerId] of [
      ['s-president', people.planningMember.memberId],
      ['s-president', people.president.memberId],
      ['s-president', null],
      ['s-planningHead', people.planningHead.memberId],
      ['s-planningHead', people.plain.memberId],
    ] as const) {
      const response = await t.post('', { ...FULL, ownerId }, user)
      assert.equal(response.status, 400, `${user} ${ownerId}`)
    }
    assert.equal(await t.eventCount(), 0)
    assert.equal(await t.count("SELECT count(*) AS n FROM record WHERE kind = 'event'"), 0)
  }),
)

test(
  '입력 경우: 필수값 누락, 빈 이름, 공백만, 상한+1(이모지), NUL, 홀로 쓰인 서러게이트, 모르는 키는 400이다',
  withEvents(async t => {
    const bad: unknown[] = [
      {},
      { name: '' },
      { name: '   ' },
      { name: '😀'.repeat(EVENT_NAME_MAX + 1) },
      { name: 'a'.repeat(EVENT_NAME_MAX + 1) },
      { name: '가\u0000나' },
      { name: '가\ud800' },
      { name: '축제', place: '😀'.repeat(EVENT_PLACE_MAX + 1) },
      { name: '축제', place: '   ' },
      { name: '축제', place: '장\u0000소' },
      { name: '축제', extra: 1 },
      { name: '축제', ownerId: 'not-a-uuid' },
      { name: '축제', ownerId: 1 },
      { name: '축제', startsAt: '2026-11-05' },
      { name: '축제', startsAt: '2026-02-30T10:00' },
      { name: '축제', startsAt: '2026-11-05T25:00' },
      { name: '축제', startsAt: '1999-12-31T23:59' },
    ]
    for (const body of bad) assert.equal((await t.post('', body)).status, 400, JSON.stringify(body))
    assert.equal(await t.eventCount(), 0)
  }),
)

test(
  '상한은 받는다: 이름과 장소가 이모지 100자',
  withEvents(async t => {
    const event = await created(
      await t.post('', { name: '😀'.repeat(EVENT_NAME_MAX), place: '😀'.repeat(EVENT_PLACE_MAX) }),
    )
    assert.equal(codePoints(event.name), EVENT_NAME_MAX)
  }),
)

test(
  '끝만 있거나 끝이 시작과 같거나 이르면 400이고, 시작보다 1분 뒤는 받는다',
  withEvents(async t => {
    const name = '축제'
    for (const [startsAt, endsAt] of [
      [null, '2026-11-05T18:00'],
      ['2026-11-05T18:00', '2026-11-05T18:00'],
      ['2026-11-05T18:00', '2026-11-05T17:59'],
    ])
      assert.equal(
        (await t.post('', { name, startsAt, endsAt })).status,
        400,
        `${startsAt} ${endsAt}`,
      )
    assert.equal(await t.eventCount(), 0)
    const ok = await created(
      await t.post('', { name, startsAt: '2026-11-05T18:00', endsAt: '2026-11-05T18:01' }),
    )
    assert.equal(ok.endsAt, '2026-11-05T18:01')
  }),
)

test('계정마다 10초에 21번째 만들기는 429이고 다른 계정은 된다', async () => {
  const t = await startEvents({ writeLimiter: createRateLimiter({ limit: 20, windowMs: 10_000 }) })
  try {
    for (let i = 0; i < 20; i++) assert.equal((await t.post('', { name: `행사 ${i}` })).status, 201)
    assert.equal((await t.post('', { name: '스물한 번째' })).status, 429)
    assert.equal(await t.eventCount(), 20)
    assert.equal((await t.post('', { name: '다른 사람' }, 's-vicePresident')).status, 201)
  } finally {
    await t.close()
  }
})

test(
  '회장단과 책임자가 고친다. 부장 같은 다른 운영진은 403이고, 같은 값이면 판이 늘지 않는다',
  withEvents(async t => {
    const owner = t.council.people.planningMember
    const event = await ownedBy(t, owner.memberId)
    const edit = { ...FULL, place: '강당' }
    assert.equal((await t.post(`/${event.id}`, edit, 's-planningHead')).status, 403)
    assert.equal((await t.post(`/${event.id}`, edit, 's-financeMember')).status, 403)
    assert.equal(await t.versions(event.id), 1)
    const response = await t.post(`/${event.id}`, edit, 's-planningMember')
    assert.equal(response.status, 200)
    const changed = ((await response.json()) as { event: EventDetail }).event
    assert.equal(changed.place, '강당')
    assert.deepEqual(changed.history.at(-1)?.changes, [
      { field: 'place', from: '대운동장', to: '강당' },
    ])
    assert.deepEqual(changed.actions, ['event.update'])
    assert.equal(await t.versions(event.id), 2)
    assert.equal((await t.post(`/${event.id}`, edit, 's-planningMember')).status, 200)
    assert.equal(await t.versions(event.id), 2)
    // 회장단은 남이 만든 행사도 고치고 판의 바꾼 사람이 회장단이다.
    const byPresident = await t.post(`/${event.id}`, { ...edit, place: '체육관' }, 's-president')
    assert.equal(byPresident.status, 200)
    const detail = await t.detail(event.id)
    assert.equal(detail.history.at(-1)?.by?.id, t.council.people.president.memberId)
    assert.deepEqual(detail.history.at(-1)?.changes, [
      { field: 'place', from: '강당', to: '체육관' },
    ])
  }),
)

test(
  '고치기도 만들기와 같은 입력 경우를 400으로 거절하고 아무것도 바꾸지 않는다',
  withEvents(async t => {
    const owner = t.council.people.planningMember
    const event = await ownedBy(t, owner.memberId)
    const bad: Record<string, unknown>[] = [
      { name: '' },
      { name: '   ' },
      { name: '😀'.repeat(EVENT_NAME_MAX + 1) },
      { name: '가\u0000나' },
      { name: '가\ud800' },
      { place: '😀'.repeat(EVENT_PLACE_MAX + 1) },
      { place: '   ' },
      { place: '장\u0000소' },
      { startsAt: '2026-11-05' },
      { startsAt: '2026-02-30T10:00' },
      { startsAt: null },
      { endsAt: '2026-11-05T14:00' },
      { endsAt: '2026-11-05T13:59' },
      { startsAt: null, endsAt: '2026-11-05T18:00' },
      { extra: 1 },
    ]
    for (const patch of bad) {
      const response = await t.post(`/${event.id}`, { ...FULL, ...patch }, 's-planningMember')
      assert.equal(response.status, 400, JSON.stringify(patch))
    }
    // 필수값 누락: 빈 본문과 칸을 하나씩 뺀 본문
    const missing = [{}, ...Object.keys(FULL).map(key => ({ ...FULL, [key]: undefined }))]
    for (const body of missing) {
      const response = await t.post(`/${event.id}`, body, 's-planningMember')
      assert.equal(response.status, 400, JSON.stringify(body))
    }
    assert.equal(await t.versions(event.id), 1)
  }),
)

test(
  '고치기는 로그인하지 않으면 401이다',
  withEvents(async t => {
    const id = await t.make({})
    assert.equal((await t.api.post(`${t.base}/${id}`, FULL)).status, 401)
  }),
)

test(
  '고치기는 일시를 비우거나 바꾸고, 끝만 남기면 400이며, 다른 학생회 행사와 틀린 번호는 404이다',
  withEvents(async t => {
    const owner = t.council.people.planningMember
    const event = await ownedBy(t, owner.memberId)
    const cleared = await t.post(
      `/${event.id}`,
      { name: FULL.name, startsAt: null, endsAt: null, place: null },
      's-planningMember',
    )
    assert.equal(cleared.status, 200)
    const detail = await t.detail(event.id)
    assert.deepEqual(
      [detail.startsAt, detail.endsAt, detail.place, detail.status],
      [null, null, null, 'tbd'],
    )
    assert.equal(
      (
        await t.post(
          `/${event.id}`,
          { name: 'x', startsAt: null, endsAt: '2026-11-05T18:00', place: null },
          's-planningMember',
        )
      ).status,
      400,
    )
    assert.equal((await t.post(`/${event.id}`, { name: 'x' }, 's-planningMember')).status, 400)
    const foreign = await t.make({}, t.other)
    assert.equal((await t.post(`/${foreign}`, FULL, 's-planningMember')).status, 404)
    assert.equal((await t.post(`/${foreign}`, FULL, 's-president')).status, 404)
    assert.equal((await t.post('/not-a-uuid', FULL, 's-planningMember')).status, 404)
    assert.equal((await t.post(`/${MISSING}`, FULL, 's-planningMember')).status, 404)
    assert.equal((await t.api.post(`${t.base}/${event.id}`, FULL)).status, 401)
    assert.equal((await t.post(`/${event.id}`, FULL, 'o-president')).status, 403)
  }),
)

test(
  '책임자가 없는 행사(만든 사람이 책임자가 되기 전의 기록)도 회장단이 고치고, 책임자를 정하는 길은 없다',
  withEvents(async t => {
    const event = { id: await t.make({ ...FULL, startsAt: null, endsAt: null }) }
    assert.equal((await t.post(`/${event.id}`, FULL, 's-planningHead')).status, 403)
    assert.equal((await t.post(`/${event.id}`, { ...FULL, place: '강당' })).status, 200)
    assert.equal((await t.post(`/${event.id}/owner`, { ownerId: null })).status, 404)
  }),
)

test(
  '책임자가 떠난 뒤에도 책임자 칸은 남고 current:false이며 같은 값으로 다시 보내도 409가 아니다',
  withEvents(async t => {
    const owner = t.council.people.planningMember
    const event = await ownedBy(t, owner.memberId)
    await inCouncilChange(
      t.db,
      { userId: 's-president', councilId: t.council.councilId, action: 'council.view', now: NOON },
      (tx, actor) => removeMember(tx, actor, owner.memberId),
    )
    const detail = await t.detail(event.id)
    assert.equal(detail.owner?.current, false)
    assert.equal(detail.owner?.id, owner.memberId)
    assert.equal((await t.post(`/${event.id}`, FULL, 's-planningMember')).status, 403)
    assert.equal((await t.post(`/${event.id}`, FULL)).status, 200)
    assert.equal(await t.versions(event.id), 1)
  }),
)
