import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ApplicantsResponse, RegistrationForm } from '@vada/contracts'
import { korean, type RegistrationKit, withRegistrations } from '../test-support/registrations.js'

// 신청 양식 정책(기능 012 조각 3): 화면에 주는 actions와 서버의 거절이 같은 판정에서 나온다(자주 잡힌 것 11·12).

const PRESIDENT = 's-president'
const OWNER = 's-planningMember'
const FINANCE = 's-financeMember'
const PLAIN = 's-plain'
const HASH = 'a'.repeat(64)

const WRITES = ['form.create', 'form.update', 'form.pause', 'form.resume', 'form.check_in'] as const
type Write = (typeof WRITES)[number]
type Expected = Record<Write, string | null>

const allWrites = (code: string | null): Expected => ({
  'form.create': code,
  'form.update': code,
  'form.pause': code,
  'form.resume': code,
  'form.check_in': code,
})

// 쓰기를 보내 막은 코드(허용이면 null)를 본다. QR 출석은 없는 토큰이라 허용이면 404다.
async function attempt(t: RegistrationKit, form: RegistrationForm, write: Write, user: string) {
  const edit = {
    name: form.name,
    opensAt: null,
    closesAt: form.closesAt,
    capacity: null,
    notice: null,
    collectsPhone: false,
    collectsStudentId: true,
    payerFee: null,
    nonPayerFee: null,
    feeAccountId: null,
  }
  const request: Record<Write, [string, unknown]> = {
    'form.create': [`/events/${form.eventId}/registration-forms`, { ...edit, name: '새 양식' }],
    'form.update': [`/registration-forms/${form.id}`, edit],
    'form.pause': [`/registration-forms/${form.id}/pause`, {}],
    'form.resume': [`/registration-forms/${form.id}/resume`, {}],
    'form.check_in': [`/events/${form.eventId}/check-in`, { tokenHash: HASH }],
  }
  const response = await t.post(...request[write], user)
  if (response.ok || (write === 'form.check_in' && response.status === 404)) return null
  return ((await response.json()) as { error: string }).error
}

const MANAGER = ['form.update', 'form.pause', 'form.check_in', 'form.view_applicants']
const withDeposit = (list: string[]) => [...list, 'deposit.confirm']
const resumeInstead = (list: string[]) => list.map(a => (a === 'form.pause' ? 'form.resume' : a))

// 양식 상태 × 사람 × 동작. 읽기 actions에 있는 쓰기는 허용되고, 없는 쓰기는 이 칸의 코드로 거절된다.
// 이미 그 상태인 멈추기·다시 받기는 쓰기가 조용히 넘어가므로(판이 늘지 않는다) 표에서 뺀다.
test(
  '양식 상태 × 사람: actions와 쓰기의 거절이 같은 판정에서 나온다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ ownerId: t.council.people.planningMember.memberId })
    const make = async (name: string) => (await t.created(event, { name })).form
    const open = await make('받는 중')
    const paused = await make('멈춤')
    await t.post(`/registration-forms/${paused.id}/pause`, {})
    const closed = await make('마감')
    const done = await make('완료')
    const openRows: [string, RegistrationForm, string, string[], Expected][] = [
      ['받는 중 회장', open, PRESIDENT, withDeposit(MANAGER), allWrites(null)],
      ['받는 중 책임자', open, OWNER, withDeposit(MANAGER), allWrites(null)],
      ['받는 중 재정', open, FINANCE, ['form.view_applicants'], allWrites('FORBIDDEN')],
      ['받는 중 일반', open, PLAIN, [], allWrites('FORBIDDEN')],
      ['멈춤 회장', paused, PRESIDENT, withDeposit(resumeInstead(MANAGER)), allWrites(null)],
    ]
    for (const [name, form, user, actions, expected] of openRows) {
      assert.deepEqual((await t.detail(form.id, user)).actions, actions, `${name} actions`)
      for (const write of WRITES) {
        if (write === 'form.create' && user === PLAIN) continue
        assert.equal(await attempt(t, form, write, user), expected[write], `${name} ${write}`)
      }
    }
    // 마감 뒤: 멈추기·다시 받기는 없고 FORM_CLOSED, 고치기(마감 늘리기)와 출석은 남는다.
    t.setNow(korean('2026-11-02T00:00'))
    assert.deepEqual(
      (await t.detail(closed.id)).actions,
      withDeposit(MANAGER.filter(a => a !== 'form.pause')),
    )
    const closedCells: Expected = {
      ...allWrites(null),
      'form.pause': 'FORM_CLOSED',
      'form.resume': 'FORM_CLOSED',
    }
    const versions = await t.versions(closed.id)
    for (const write of WRITES)
      assert.equal(await attempt(t, closed, write, PRESIDENT), closedCells[write], `마감 ${write}`)
    // 고치기는 판을 만들었어도 멈추기·다시 받기는 만들지 않았다.
    assert.equal(await t.versions(closed.id), versions)
    // 완료한 행사: 신청자 보기만 남고 쓰기는 모두 EVENT_COMPLETED다.
    await t.complete(event)
    const asDone = await t.detail(done.id)
    assert.deepEqual(asDone.actions, ['form.view_applicants'])
    assert.equal(asDone.status, 'closed')
    assert.deepEqual((await t.detail(done.id, FINANCE)).actions, ['form.view_applicants'])
    assert.deepEqual((await t.detail(done.id, PLAIN)).actions, [])
    for (const write of WRITES)
      assert.equal(await attempt(t, done, write, PRESIDENT), 'EVENT_COMPLETED', `완료 ${write}`)
    // 403이 409보다 먼저다: 권한 없는 사람은 완료한 행사에서도 FORBIDDEN이다.
    assert.equal(await attempt(t, done, 'form.update', PLAIN), 'FORBIDDEN')
  }),
)

test(
  '마감 경계는 ±1초: 마감 1초 전에는 멈출 수 있고 마감 시각부터 FORM_CLOSED이며 판이 생기지 않는다',
  withRegistrations(async t => {
    const { form } = await t.created(await t.makeEvent())
    t.setNow(korean('2026-11-01T17:59:59'))
    assert.ok((await t.detail(form.id)).actions.includes('form.pause'))
    t.setNow(korean('2026-11-01T18:00:00'))
    const actions: string[] = (await t.detail(form.id)).actions
    assert.ok(!actions.includes('form.pause') && !actions.includes('form.resume'))
    const before = await t.versions(form.id)
    for (const path of ['pause', 'resume']) {
      const response = await t.post(`/registration-forms/${form.id}/${path}`, {})
      assert.equal(response.status, 409, path)
      assert.equal(((await response.json()) as { error: string }).error, 'FORM_CLOSED', path)
    }
    assert.equal(await t.versions(form.id), before)
  }),
)

test(
  '목록의 form.create는 관리 권한자에게 완료 전만, 신청자 목록은 완료 뒤에도 열람 권한자에게 열리고 열람 기록이 남는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.created(event)
    await t.applied(form.publicCode, { name: '김신청', studentId: '202612345' })
    const create = async (user: string) => (await t.list(event, user)).actions
    assert.deepEqual(await create(PRESIDENT), ['form.create'])
    assert.deepEqual(await create(FINANCE), [])
    const applicants = (user: string) =>
      t.api.get(`${t.orgBase}/registration-forms/${form.id}/applicants`, user)
    const logs = () => t.count('SELECT count(*) AS n FROM applicant_access_log')
    assert.equal((await applicants(PRESIDENT)).status, 200)
    assert.equal(await logs(), 1)
    await t.complete(event)
    assert.deepEqual(await create(PRESIDENT), [])
    for (const user of [PRESIDENT, FINANCE]) {
      const response = await applicants(user)
      assert.equal(response.status, 200, user)
      assert.equal(((await response.json()) as ApplicantsResponse).applicants.length, 1)
    }
    assert.equal(await logs(), 3)
    // 열람 권한이 없으면 완료 뒤에도 403이고 기록이 없다.
    assert.equal((await applicants(PLAIN)).status, 403)
    assert.equal(await logs(), 3)
    // 공개 응답도 운영진 응답과 같이 닫힘이다.
    assert.equal((await t.publicForm(form.publicCode)).status, 'closed')
    assert.equal((await t.detail(form.id)).status, 'closed')
    // 다른 학생회 양식은 404다.
    const crossed = `/api/organizations/${t.other.councilId}/registration-forms/${form.id}/applicants`
    assert.equal((await t.api.get(crossed, 'o-president')).status, 404)
  }),
)
