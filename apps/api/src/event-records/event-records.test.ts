import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventRecord, EventRecordResponse, RecordEventsResponse } from '@vada/contracts'
import { clockNow } from '../records/records.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 기록 메뉴(기능 030, DEC-110): 완료한 행사 목록과 행사 기록. 숫자는 정산·신청 양식·업무와 같은 셈이다.

const HOUR = 60 * 60 * 1000
const recordsBase = (t: SettlementKit, councilId = t.council.councilId) =>
  `/api/organizations/${councilId}/records/events`

const listOf = async (t: SettlementKit, user = 's-president') => {
  const response = await t.api.get(recordsBase(t), user)
  assert.equal(response.status, 200)
  return (await response.json()) as RecordEventsResponse
}
const readRecord = (
  t: SettlementKit,
  eventId: string,
  user = 's-president',
  base = recordsBase(t),
) => t.api.get(`${base}/${eventId}`, user)
const recordOf = async (t: SettlementKit, eventId: string): Promise<EventRecord> => {
  const response = await readRecord(t, eventId)
  assert.equal(response.status, 200)
  return ((await response.json()) as EventRecordResponse).record
}
const attend = (t: SettlementKit, registrationId: string, values: Record<string, unknown> = {}) =>
  t.make(t.council, 'attendance', {
    registrationId,
    confirmedAt: clockNow,
    method: 'qr',
    ...values,
  })
const task = (t: SettlementKit, values: Record<string, unknown>) =>
  t.make(t.council, 'task', { title: '업무', ...values })
const complete = (t: SettlementKit, eventId: string, at = '2026-10-24T03:00:00Z') =>
  t.completion(eventId, 'completed', new Date(at))

test(
  '목록은 완료한 행사만, 완료 처리가 최근인 것부터 준다. 완료를 취소한 행사와 완료하지 않은 행사는 없다',
  withSettlement(async t => {
    const early = await t.event({ name: '먼저 완료' })
    const late = await t.event({ name: '나중 완료' })
    const undone = await t.event({ name: '완료 취소' })
    await t.event({ name: '완료 안 함' })
    await complete(t, early, '2026-10-21T03:00:00Z')
    await complete(t, late, '2026-10-23T03:00:00Z')
    await complete(t, undone, '2026-10-22T03:00:00Z')
    await t.completion(
      undone,
      'completion_cancelled',
      new Date('2026-10-22T04:00:00Z'),
      '정산 다시',
    )
    const list = await listOf(t)
    assert.deepEqual(
      list.events.map(item => item.name),
      ['나중 완료', '먼저 완료'],
    )
    assert.equal(list.truncated, false)
    assert.equal(list.events[0]!.completedAt, '2026-10-23T03:00:00.000Z')
    // 완료를 취소한 행사는 상세도 없다
    assert.equal((await readRecord(t, undone)).status, 404)
    // 다시 완료하면 다시 나온다
    await complete(t, undone, '2026-10-24T03:00:00Z')
    assert.deepEqual(
      (await listOf(t)).events.map(item => item.name),
      ['완료 취소', '나중 완료', '먼저 완료'],
    )
  }),
)

test(
  '목록 카드의 칩: 출석·신청(취소 뺌), 예산·실제·집행률(정산과 같다), 끝난 업무. 담당은 끝난 업무의 부서까지 이름순',
  withSettlement(async t => {
    const ev = await t.event({ name: '봄 축제', ownerId: t.council.people.president.memberId })
    const form = await t.form(ev)
    const a = await t.registration(form)
    await t.registration(form)
    const gone = await t.registration(form)
    await attend(t, a)
    await attend(t, gone)
    await t.change('registration', gone, { cancelledAt: clockNow })
    const { budget } = await t.budgetOf()
    await t.budgetItem(budget, { eventId: ev, amount: '80000' })
    await t.budgetItem(budget, { eventId: ev, type: 'income', amount: '30000', purpose: '후원' })
    await t.expense({ eventId: ev, amount: '50000' })
    await t.expense({ eventId: ev, amount: '9999', cancelledAt: clockNow })
    const { finance, planning } = t.council.departments
    await task(t, { eventId: ev, status: 'done', departmentId: planning })
    await task(t, { eventId: ev, status: 'done', departmentId: finance })
    await task(t, { eventId: ev, status: 'in_progress', departmentId: planning })
    await task(t, { eventId: ev, status: 'done', cancelledAt: clockNow })
    // 예산 없는 행사의 집행률은 null이다
    const noBudget = await t.event({ name: '예산 없음' })
    await t.expense({ eventId: noBudget, amount: '12000' })
    const settlement = await t.settlement(ev)
    await complete(t, ev, '2026-10-24T03:00:00Z')
    await complete(t, noBudget, '2026-10-23T03:00:00Z')
    const [first, second] = (await listOf(t)).events
    assert.deepEqual(first!.chips, {
      attended: 1,
      applied: 2,
      budget: 80000,
      actual: 50000,
      executionRate: 63,
      tasksDone: 2,
    })
    assert.equal(first!.chips.budget, settlement.budget.expense)
    assert.equal(first!.chips.actual, settlement.actual.expense)
    assert.deepEqual(first!.departments, ['기획부', '재정부'])
    assert.equal(first!.owner?.id, t.council.people.president.memberId)
    assert.equal(first!.startsAt, '2026-10-20T09:00')
    assert.deepEqual(second!.chips, {
      attended: 0,
      applied: 0,
      budget: 0,
      actual: 12000,
      executionRate: null,
      tasksDone: 0,
    })
  }),
)

test(
  '상세 성과: 신청 전체·취소·출석·출석률(분모는 신청 − 취소), 돈은 정산과 같고 업무는 끝남/전체다',
  withSettlement(async t => {
    const ev = await t.event()
    const first = await t.form(ev)
    const second = await t.form(ev)
    const a = await t.registration(first)
    const b = await t.registration(first)
    await t.registration(second)
    await t.registration(second, { cancelledAt: clockNow })
    await attend(t, a)
    // 취소한 출석은 출석이 아니다
    await attend(t, b, { cancelledAt: clockNow })
    // 다른 행사의 신청은 들지 않는다
    await t.registration(await t.form(await t.event({ name: '다른 행사' })))
    const { budget } = await t.budgetOf()
    await t.budgetItem(budget, { eventId: ev, amount: '100000' })
    await t.expense({ eventId: ev, amount: '120000' })
    await task(t, { eventId: ev, status: 'done' })
    await task(t, { eventId: ev })
    const settlement = await t.settlement(ev)
    await complete(t, ev)
    const record = await recordOf(t, ev)
    assert.deepEqual(record.outcome, {
      registrations: { total: 4, cancelled: 1, attended: 1, rate: 33 },
      money: { budget: 100000, actual: 120000, difference: -20000, rate: 120 },
      tasks: { done: 1, total: 2 },
    })
    assert.equal(record.outcome.money.difference, settlement.difference)
  }),
)

test(
  '신청이 모두 취소되면 출석률은 null, 신청이 없으면 0이고 null이다',
  withSettlement(async t => {
    const allCancelled = await t.event({ name: '모두 취소' })
    const form = await t.form(allCancelled)
    await t.registration(form, { cancelledAt: clockNow })
    const empty = await t.event({ name: '신청 없음' })
    await complete(t, allCancelled)
    await complete(t, empty)
    assert.deepEqual((await recordOf(t, allCancelled)).outcome.registrations, {
      total: 1,
      cancelled: 1,
      attended: 0,
      rate: null,
    })
    const record = await recordOf(t, empty)
    assert.deepEqual(record.outcome.registrations, {
      total: 0,
      cancelled: 0,
      attended: 0,
      rate: null,
    })
    assert.deepEqual(record.outcome.money, { budget: 0, actual: 0, difference: 0, rate: null })
  }),
)

test(
  '개요: 완료한 사람·시각과 담당, 근거 자료 수는 취소한 것을 뺀다',
  withSettlement(async t => {
    const ev = await t.event({ place: '학생회관', ownerId: t.council.people.president.memberId })
    await task(t, { eventId: ev, status: 'done', departmentId: t.council.departments.planning })
    await task(t, { eventId: ev, cancelledAt: clockNow })
    await t.make(t.council, 'meeting', { title: '준비 회의', heldAt: new Date(), eventId: ev })
    await t.make(t.council, 'meeting', {
      title: '취소한 회의',
      heldAt: new Date(),
      eventId: ev,
      cancelledAt: clockNow,
      cancelReason: '미룸',
    })
    await t.requestWithItem(ev)
    await t.requestWithItem(ev, { cancelledAt: clockNow })
    await t.requestWithItem(null)
    await complete(t, ev, '2026-10-24T03:00:00Z')
    const record = await recordOf(t, ev)
    assert.deepEqual(record.overview, {
      id: ev,
      name: '봄 축제',
      startsAt: '2026-10-20T09:00',
      endsAt: null,
      place: '학생회관',
      owner: { id: t.council.people.president.memberId, name: 's president', current: true },
      departments: ['기획부'],
      completedAt: '2026-10-24T03:00:00.000Z',
      completedBy: { id: t.council.people.president.memberId, name: 's president' },
    })
    assert.deepEqual(record.sources, { tasks: 1, meetings: 1, purchases: 1 })
  }),
)

test(
  '타임라인: 만듦·정보 변경·회의·완료·완료 취소를 시각순으로. 취소한 회의는 없다',
  withSettlement(async t => {
    const t0 = Date.now()
    const ev = await t.event()
    await t.change('event', ev, { place: '학생회관', startsAt: new Date('2026-10-21T00:00:00Z') })
    // 행사를 만들기 전 회의도 시각 자리에 들어간다
    const before = await t.make(t.council, 'meeting', {
      title: '첫 회의',
      heldAt: new Date(t0 - 24 * HOUR),
      eventId: ev,
    })
    const after = await t.make(t.council, 'meeting', {
      title: '점검 회의',
      heldAt: new Date(t0 + HOUR),
      eventId: ev,
    })
    await t.make(t.council, 'meeting', {
      title: '취소',
      heldAt: new Date(t0 + HOUR),
      eventId: ev,
      cancelledAt: clockNow,
      cancelReason: '미룸',
    })
    await t.completion(ev, 'completed', new Date(t0 + 2 * HOUR))
    await t.completion(ev, 'completion_cancelled', new Date(t0 + 3 * HOUR), '지출 고침')
    await t.completion(ev, 'completed', new Date(t0 + 4 * HOUR))
    const { timeline } = await recordOf(t, ev)
    assert.deepEqual(
      timeline.map(line => [line.kind, line.text, line.recordId]),
      [
        ['meeting', '첫 회의', before],
        ['created', '행사 만듦', null],
        ['changed', '일시·장소 변경', null],
        ['meeting', '점검 회의', after],
        ['completed', '완료', null],
        ['completion_cancelled', '완료 취소', null],
        ['completed', '완료', null],
      ],
    )
    const times = timeline.map(line => line.at)
    assert.deepEqual(times, [...times].sort())
    assert.equal(timeline[1]!.by?.id, t.council.people.president.memberId)
    assert.equal(timeline[4]!.by?.name, 's president')
  }),
)

test(
  '목록과 상세 응답에는 신청자 이름·학번·휴대폰이 없다',
  withSettlement(async t => {
    const ev = await t.event()
    const form = await t.form(ev)
    await t.registration(form, { name: '홍길동', studentId: '2026123456', phone: '01098765432' })
    await complete(t, ev)
    for (const response of [
      await t.api.get(recordsBase(t), 's-president'),
      await readRecord(t, ev),
    ]) {
      assert.equal(response.status, 200)
      const text = await response.text()
      for (const value of ['홍길동', '2026123456', '01098765432']) assert.ok(!text.includes(value))
    }
  }),
)

test(
  '역할별 읽기: 이 학생회 운영진은 모두 본다. 내보낸 사람·다른 학생회는 403, 다른 학생회 행사와 완료하지 않은 행사는 404, 로그인 없으면 401',
  withSettlement(async t => {
    const ev = await t.event()
    const open = await t.event({ name: '진행 중' })
    await complete(t, ev)
    for (const user of [
      's-president',
      's-vicePresident',
      's-financeMember',
      's-planningHead',
      's-planningMember',
      's-plain',
    ]) {
      assert.equal((await readRecord(t, ev, user)).status, 200, user)
      assert.equal((await listOf(t, user)).events.length, 1, user)
    }
    assert.equal((await readRecord(t, ev, 's-ended')).status, 403)
    assert.equal((await t.api.get(recordsBase(t), 's-ended')).status, 403)
    assert.equal((await readRecord(t, ev, 'o-president')).status, 403)
    assert.equal((await t.api.get(recordsBase(t), 'o-president')).status, 403)
    // 다른 학생회 사람이 자기 학생회 경로로 이 행사를 물으면 없는 것과 같다
    const otherBase = recordsBase(t, t.other.councilId)
    assert.equal((await readRecord(t, ev, 'o-president', otherBase)).status, 404)
    assert.equal((await readRecord(t, open)).status, 404)
    assert.equal((await readRecord(t, 'not-a-uuid')).status, 404)
    assert.equal((await t.api.get(`${recordsBase(t)}/${ev}`)).status, 401)
    assert.equal((await t.api.get(recordsBase(t))).status, 401)
  }),
)

test(
  '다른 학생회의 완료한 행사와 기록은 우리 목록과 숫자에 섞이지 않는다',
  withSettlement(async t => {
    const ours = await t.event({ name: '우리 행사' })
    const theirs = await t.event({ name: '그쪽 행사' }, t.other)
    await t.completionOfOther(theirs)
    await t.registration(await t.form(theirs, t.other), {}, t.other)
    await t.expense({ eventId: theirs }, t.other)
    await complete(t, ours)
    const list = await listOf(t)
    assert.deepEqual(
      list.events.map(item => item.name),
      ['우리 행사'],
    )
    assert.deepEqual(list.events[0]!.chips, {
      attended: 0,
      applied: 0,
      budget: 0,
      actual: 0,
      executionRate: null,
      tasksDone: 0,
    })
  }),
)

test(
  '같은 시각의 완료 → 완료 취소 → 다시 완료는 결재 차례대로 보인다',
  withSettlement(async t => {
    const ev = await t.event()
    const at = new Date(Date.now() + HOUR)
    await t.completion(ev, 'completed', at)
    await t.completion(ev, 'completion_cancelled', at, '고침')
    await t.completion(ev, 'completed', at)
    const { timeline } = await recordOf(t, ev)
    assert.deepEqual(
      timeline.slice(-3).map(line => line.kind),
      ['completed', 'completion_cancelled', 'completed'],
    )
  }),
)

test(
  '기록 모듈을 거치지 않고 다른 학생회 부서·출석·결재가 우리 기록을 가리켜도 이름·수·완료가 새지 않는다',
  withSettlement(async t => {
    const ev = await t.event({ name: '우리 행사' })
    const job = await task(t, {
      eventId: ev,
      status: 'done',
      departmentId: t.council.departments.planning,
    })
    const ours = await t.registration(await t.form(ev))
    const theirEvent = await t.event({ name: '그쪽 행사' }, t.other)
    const theirReg = await t.registration(await t.form(theirEvent, t.other), {}, t.other)
    const theirAttendance = await t.make(t.other, 'attendance', {
      registrationId: theirReg,
      confirmedAt: clockNow,
      method: 'qr',
    })
    const theirCompletion = await t.completionOfOther(theirEvent)
    await t.pg.query('UPDATE department SET name = $1 WHERE id = $2', [
      '그쪽 부서',
      t.other.departments.planning,
    ])
    await t.pg.query('UPDATE task SET department_id = $1 WHERE id = $2', [
      t.other.departments.planning,
      job,
    ])
    await t.pg.query('UPDATE attendance SET registration_id = $1 WHERE id = $2', [
      ours,
      theirAttendance,
    ])
    // 우리 행사는 완료하지 않았고, 그쪽 결재만 우리 행사를 가리킨다
    const quiet = await t.event({ name: '완료 안 함' })
    await t.pg.query('UPDATE approval SET target_id = $1 WHERE id = $2', [quiet, theirCompletion])
    await complete(t, ev)
    const list = await listOf(t)
    assert.deepEqual(
      list.events.map(item => item.name),
      ['우리 행사'],
    )
    assert.deepEqual(list.events[0]!.departments, [])
    assert.equal(list.events[0]!.chips.attended, 0)
    const record = await recordOf(t, ev)
    assert.deepEqual(record.overview.departments, [])
    assert.equal(record.outcome.registrations.attended, 0)
    assert.equal((await readRecord(t, quiet)).status, 404)
  }),
)
