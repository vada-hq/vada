import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EVENT_SETTLEMENTS_LIMIT,
  type EventSettlementsResponse,
  type HomeResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createHomeRoutes } from '../home/routes.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 시험 묶음의 시계(한국 2026-10-25 12:00). 기간은 2026-09-01 ~ 2027-02-28(budgetOf).
const now = new Date('2026-10-25T03:00:00Z')

async function tabOf(t: SettlementKit, user = 's-financeMember') {
  const response = await t.api.get(
    `/api/organizations/${t.council.councilId}/event-settlements`,
    user,
  )
  assert.equal(response.status, 200)
  return (await response.json()) as EventSettlementsResponse
}

async function homeOf(t: SettlementKit, user = 's-financeMember') {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const response = await api.get(`/api/organizations/${t.council.councilId}/home`, user)
  assert.equal(response.status, 200)
  return (await response.json()) as HomeResponse
}

const at = (iso: string) => new Date(iso)

// 두 학생회에 같은 날짜·같은 값의 행사를 둔다. 학생회 거르기를 지우면 다른 학생회 행사가 섞여 실패한다.
async function seedEvents(t: SettlementKit, owner: SettlementKit['council']) {
  const make = (values: Record<string, unknown>) => t.event(values, owner)
  const ids = {
    // 지난 기간에 끝났고 완료하지 않은 행사도 정산이 남은 일이라 홈처럼 맨 위에 있다.
    endedOld: await make({ name: '여름 캠프', startsAt: at('2026-08-10T00:00:00Z') }),
    ended: await make({ name: '봄 축제' }),
    endedClean: await make({ name: '체육 대회', startsAt: at('2026-10-21T00:00:00Z') }),
    ongoing: await make({
      name: '전시',
      startsAt: at('2026-10-25T00:00:00Z'),
      endsAt: at('2026-10-26T00:00:00Z'),
    }),
    upcoming: await make({ name: '간식 행사', startsAt: at('2026-11-10T00:00:00Z') }),
    tbd: await make({ name: '졸업 파티', startsAt: null }),
    nextPeriod: await make({ name: '새내기 배움터', startsAt: at('2027-03-10T00:00:00Z') }),
    done: await make({ name: '개강 파티', startsAt: at('2026-09-05T00:00:00Z') }),
    doneLater: await make({ name: '중간 간식', startsAt: at('2026-10-15T00:00:00Z') }),
    doneOld: await make({ name: '지난 축제', startsAt: at('2026-05-01T00:00:00Z') }),
  }
  return ids
}

async function completeAll(t: SettlementKit, ids: string[], owner: 'council' | 'other') {
  for (const id of ids)
    if (owner === 'council') await t.completion(id, 'completed', at('2026-10-24T03:00:00Z'))
    else await t.completionOfOther(id)
}

test(
  '지금 기간의 행사가 끝났고 완료하지 않은 것 → 진행 중 → 완료 차례이고 줄마다 상태와 정산 남은 것 수가 있다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    await t.budgetOf(t.other)
    const ours = await seedEvents(t, t.council)
    const theirs = await seedEvents(t, t.other)
    await completeAll(t, [ours.done, ours.doneLater, ours.doneOld], 'council')
    await completeAll(t, [theirs.done, theirs.doneLater, theirs.doneOld], 'other')
    await t.requestWithItem(ours.ended, { title: '대기' })
    await t.expense({ eventId: ours.ended, reason: null })
    await t.requestWithItem(ours.ongoing, { title: '진행 중 대기' })
    const tab = await tabOf(t)
    assert.deepEqual(tab.period, { id: period, name: '2026-2' })
    assert.equal(tab.truncated, false)
    assert.deepEqual(
      tab.events.map(row => [row.event.name, row.event.status]),
      [
        ['여름 캠프', 'ended'],
        ['봄 축제', 'ended'],
        ['체육 대회', 'ended'],
        ['전시', 'ongoing'],
        ['간식 행사', 'upcoming'],
        ['졸업 파티', 'tbd'],
        ['중간 간식', 'completed'],
        ['개강 파티', 'completed'],
      ],
    )
    const byName = new Map(tab.events.map(row => [row.event.name, row.settlement]))
    const sum = async (eventId: string) =>
      (await t.settlement(eventId)).remaining.reduce((total, item) => total + item.count, 0)
    assert.ok((await sum(ours.ended)) > 1)
    assert.deepEqual(byName.get('봄 축제'), { remaining: await sum(ours.ended), settled: false })
    assert.deepEqual(byName.get('체육 대회'), { remaining: 0, settled: true })
    // 끝나기 전의 행사는 남은 것이 0이어도 아직 진행 중인 일이라 끝난 것이 아니다.
    assert.deepEqual(byName.get('전시'), { remaining: 1, settled: false })
    assert.deepEqual(byName.get('간식 행사'), { remaining: 0, settled: false })
    assert.deepEqual(byName.get('개강 파티'), { remaining: 0, settled: true })
    // 다른 학생회 행사는 같은 날짜·같은 이름이어도 없다.
    const otherIds = new Set(Object.values(theirs))
    assert.ok(tab.events.every(row => !otherIds.has(row.event.id)))
  }),
)

test(
  '끝났고 완료하지 않은 행사와 그 수는 같은 사람의 홈 정산할 행사와 같다',
  withSettlement(async t => {
    await t.budgetOf()
    const ours = await seedEvents(t, t.council)
    await seedEvents(t, t.other)
    await completeAll(t, [ours.done, ours.doneLater, ours.doneOld], 'council')
    await t.requestWithItem(ours.ended, { title: '대기' })
    await t.expense({ eventId: ours.endedOld, reason: null })
    const tab = await tabOf(t)
    const home = await homeOf(t)
    const ended = tab.events.filter(row => row.event.status === 'ended')
    assert.deepEqual(ended, home.settling!.events)
    assert.equal(ended.length, home.settling!.total)
  }),
)

test(
  '재정 역할이 아닌 운영진도 같은 목록을 보고, 다른 학생회 사람과 로그인하지 않은 사람은 못 본다',
  withSettlement(async t => {
    await t.budgetOf()
    const ours = await seedEvents(t, t.council)
    await t.requestWithItem(ours.ended, { title: '대기' })
    const finance = await tabOf(t)
    for (const user of ['s-planningMember', 's-planningHead', 's-president'])
      assert.deepEqual(await tabOf(t, user), finance, user)
    const path = `/api/organizations/${t.council.councilId}/event-settlements`
    assert.equal((await t.api.get(path, 'o-financeMember')).status, 403)
    assert.equal((await t.api.get(path)).status, 401)
  }),
)

test(
  '행사가 없으면 빈 목록이고, 회계 기간이 없으면 기간으로 거르지 않는다',
  withSettlement(async t => {
    assert.deepEqual(await tabOf(t), { period: null, events: [], truncated: false })
    const ours = await seedEvents(t, t.council)
    await t.completion(ours.doneOld, 'completed', at('2026-10-24T03:00:00Z'))
    const names = (await tabOf(t)).events.map(row => row.event.name)
    assert.ok(names.includes('새내기 배움터'))
    assert.ok(names.includes('지난 축제'))
    assert.equal(names.length, Object.keys(ours).length)
  }),
)

test(
  '기간에 드는지는 행사 끝 날짜(끝이 없으면 시작)의 한국 날짜로 본다(±1초)',
  withSettlement(async t => {
    await t.budgetOf()
    const ids = {
      // 완료한 행사는 끝 날짜가 기간 안일 때만 든다(시작일 9월 1일 한국 0시).
      before: await t.event({
        name: '앞 완료',
        startsAt: at('2026-08-31T10:00:00Z'),
        endsAt: at('2026-08-31T14:59:59Z'),
      }),
      first: await t.event({
        name: '첫날 완료',
        startsAt: at('2026-08-31T10:00:00Z'),
        endsAt: at('2026-08-31T15:00:00Z'),
      }),
    }
    await completeAll(t, Object.values(ids), 'council')
    // 끝나지 않은 행사는 끝 날짜가 기간 끝일(2월 28일 한국) 이하일 때 든다.
    await t.event({ name: '끝일 행사', startsAt: at('2027-02-28T14:59:59Z') })
    await t.event({ name: '다음 날 행사', startsAt: at('2027-02-28T15:00:00Z') })
    const names = (await tabOf(t)).events.map(row => row.event.name)
    assert.deepEqual(names, ['끝일 행사', '첫날 완료'])
  }),
)

test(
  `행사는 ${EVENT_SETTLEMENTS_LIMIT}개까지이고 넘치면 truncated이며, 끝났고 완료하지 않은 행사가 먼저 자리를 잡는다`,
  withSettlement(async t => {
    await t.budgetOf()
    for (let index = 0; index < EVENT_SETTLEMENTS_LIMIT; index++)
      await t.event({ name: `예정 ${index}`, startsAt: at('2026-11-10T00:00:00Z') })
    await t.event({ name: '끝남', startsAt: at('2026-10-01T00:00:00Z') })
    const tab = await tabOf(t)
    assert.equal(tab.events.length, EVENT_SETTLEMENTS_LIMIT)
    assert.equal(tab.truncated, true)
    assert.equal(tab.events[0]?.event.name, '끝남')
  }),
)
