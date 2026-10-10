import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FeeSettingsResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
async function refused(pending: Response | Promise<Response>, status: number, error: string, label = error) {
  const response = await pending
  assert.equal(response.status, status, label)
  assert.deepEqual(await response.json(), { error }, label)
}
const at = (value: string) => new Date(`${value}:00+09:00`)
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const account = (overrides: Record<string, unknown> = {}) => ({ version: 0, bank: '카카오뱅크', accountNumber: '3333-01-1234567',
  holder: '컴퓨터학부 학생회', ...overrides })
const roster = (overrides: Record<string, unknown> = {}) => ({ version: 0, label: '2999년 2학기 납부자', useUntil: '2999-12-31',
  members: [{ studentId: '2022-000002', name: '박해랑' }, { studentId: '2022000001', name: '김바다' }], ...overrides })
const settings = (env: Env) => env.ok<FeeSettingsResponse>(env.request('GET', '/fee-settings'))
const memberCount = async (env: Env) => (await env.pg.query<{ count: number }>('SELECT count(*)::int AS count FROM dues_members')).rows[0]!.count

test('참가비 설정은 재정 부서와 회장단만 보고 바꾼다', async () => {
  const env = await setupPurchases()
  try {
    env.clock.set(at('2999-08-01T00:00'))
    for (const user of ['f', 'l']) {
      env.as(user)
      assert.deepEqual(await settings(env), { account: null, accountHistory: [], roster: null }, user)
    }
    for (const user of ['p', 'n', 'x']) {
      env.as(user)
      await refused(env.request('GET', '/fee-settings'), 403, 'FORBIDDEN', user)
      await refused(env.request('POST', '/fee-account', account()), 403, 'FORBIDDEN', user)
      await refused(env.request('POST', '/dues-roster', roster()), 403, 'FORBIDDEN', user)
      await refused(env.request('POST', '/dues-roster/delete', { version: 1 }), 403, 'FORBIDDEN', user)
    }
    env.as(null)
    assert.equal((await env.request('GET', '/fee-settings')).status, 401)
    assert.equal((await env.request('POST', '/fee-account', account())).status, 401)
    assert.equal((await env.request('POST', '/dues-roster', roster())).status, 401)
    assert.equal((await env.request('POST', '/dues-roster/delete', { version: 1 })).status, 401)
    assert.equal(await memberCount(env), 0)
  } finally { await env.pg.close() }
})

test('학생회 계좌: 처음 정하면 버전 1과 기록 한 줄이고, 바꾸면 기록이 쌓이며, 같은 값이면 그대로다', async () => {
  const env = await setupPurchases()
  try {
    env.clock.set(at('2999-08-01T00:00'))
    env.as('f')
    const first = await env.ok<FeeSettingsResponse>(env.request('POST', '/fee-account', account({ accountNumber: ' 3333 01 1234567 ' })))
    assert.deepEqual({ ...first.account!, updatedAt: '' }, { bank: '카카오뱅크', accountNumber: '3333011234567', holder: '컴퓨터학부 학생회', version: 1,
      updatedAt: '', updatedBy: { id: 'f', name: '재정' } })
    assert.deepEqual(first.accountHistory.map(entry => [entry.actor.name, entry.from, entry.to]),
      [['재정', null, { bank: '카카오뱅크', accountNumber: '3333011234567', holder: '컴퓨터학부 학생회' }]])
    env.as('l')
    const changed = await env.ok<FeeSettingsResponse>(env.request('POST', '/fee-account', account({ version: 1, bank: '국민은행' })))
    assert.deepEqual([changed.account!.version, changed.account!.bank, changed.account!.accountNumber, changed.account!.updatedBy.name],
      [2, '국민은행', '3333-01-1234567', '회장'])
    // 최근 것부터 준다.
    assert.deepEqual(changed.accountHistory.map(entry => [entry.actor.name, entry.from?.bank ?? null, entry.to.bank]),
      [['회장', '카카오뱅크', '국민은행'], ['재정', null, '카카오뱅크']])
    const same = await env.ok<FeeSettingsResponse>(env.request('POST', '/fee-account', account({ version: 2, bank: '국민은행' })))
    assert.deepEqual(same, changed)
    await refused(env.request('POST', '/fee-account', account({ version: 1 })), 409, 'VERSION_CONFLICT')
    await refused(env.request('POST', '/fee-account', account({ version: 0 })), 409, 'VERSION_CONFLICT')
  } finally { await env.pg.close() }
})

test('학생회비 명단: 학번을 정리해 학번 순으로 두고, 다시 올리면 통째로 바꾸며, 지우면 납부자도 사라진다', async () => {
  const env = await setupPurchases()
  try {
    env.clock.set(at('2999-08-01T00:00'))
    env.as('f')
    const first = await env.ok<FeeSettingsResponse>(env.request('POST', '/dues-roster', roster()))
    assert.deepEqual({ ...first.roster!, uploadedAt: '' }, { label: '2999년 2학기 납부자', useUntil: '2999-12-31', version: 1, uploadedAt: '',
      uploadedBy: { id: 'f', name: '재정' }, members: [{ studentId: '2022000001', name: '김바다' }, { studentId: '2022000002', name: '박해랑' }] })
    env.as('l')
    const second = await env.ok<FeeSettingsResponse>(env.request('POST', '/dues-roster', roster({ version: 1, label: '새 명단',
      members: [{ studentId: '2023000003', name: '이윤슬' }] })))
    assert.deepEqual([second.roster!.version, second.roster!.label, second.roster!.uploadedBy.name, second.roster!.members],
      [2, '새 명단', '회장', [{ studentId: '2023000003', name: '이윤슬' }]])
    assert.equal(await memberCount(env), 1)
    await refused(env.request('POST', '/dues-roster', roster({ version: 1 })), 409, 'VERSION_CONFLICT')
    await refused(env.request('POST', '/dues-roster/delete', { version: 1 }), 409, 'VERSION_CONFLICT')
    const deleted = await env.ok<FeeSettingsResponse>(env.request('POST', '/dues-roster/delete', { version: 2 }))
    assert.equal(deleted.roster, null)
    assert.equal(await memberCount(env), 0)
    // 없는 명단은 지울 수 없고, 지운 뒤에는 버전 0으로 다시 올린다.
    await refused(env.request('POST', '/dues-roster/delete', { version: 1 }), 409, 'VERSION_CONFLICT')
    assert.equal((await env.ok<FeeSettingsResponse>(env.request('POST', '/dues-roster', roster()))).roster!.version, 1)
  } finally { await env.pg.close() }
})

test('학생회비 명단의 쓰는 기한은 오늘(한국 날짜)부터 366일 안이다', async () => {
  const env = await setupPurchases()
  try {
    // 한국은 3월 1일 0시 30분이고, 세계 표준시로는 아직 2월 28일이다.
    env.clock.set(at('2998-03-01T00:30'))
    env.as('f')
    await refused(env.request('POST', '/dues-roster', roster({ useUntil: '2998-02-28' })), 409, 'USE_UNTIL_INVALID')
    await env.ok(env.request('POST', '/dues-roster', roster({ useUntil: '2998-03-01' })))
    await env.ok(env.request('POST', '/dues-roster', roster({ version: 1, useUntil: '2999-03-02' })))
    await refused(env.request('POST', '/dues-roster', roster({ version: 2, useUntil: '2999-03-03' })), 409, 'USE_UNTIL_INVALID')
  } finally { await env.pg.close() }
})

test('쓰는 기한이 지난 명단은 읽거나 바꾸기 전에 지우고, 기한 당일에는 그대로 둔다', async () => {
  const env = await setupPurchases()
  try {
    env.clock.set(at('2999-08-01T00:00'))
    env.as('f')
    await env.ok(env.request('POST', '/dues-roster', roster()))
    await env.pg.query("UPDATE dues_rosters SET use_until = '2999-08-01'")
    assert.equal((await settings(env)).roster?.useUntil, '2999-08-01')
    await env.pg.query("UPDATE dues_rosters SET use_until = '2999-07-31'")
    assert.equal((await settings(env)).roster, null)
    assert.equal(await memberCount(env), 0)
    // 바꾸는 요청도 먼저 지운다. 그래서 지운 명단의 버전으로는 바꿀 수 없다.
    await env.ok(env.request('POST', '/dues-roster', roster()))
    await env.pg.query("UPDATE dues_rosters SET use_until = '2999-07-31'")
    await refused(env.request('POST', '/dues-roster', roster({ version: 1 })), 409, 'VERSION_CONFLICT')
    await env.ok(env.request('POST', '/dues-roster', roster({ version: 0 })))
  } finally { await env.pg.close() }
})

test('학생회비 명단 10,000명을 한 번에 올린다', async () => {
  const env = await setupPurchases()
  try {
    env.clock.set(at('2999-08-01T00:00'))
    env.as('f')
    const members = Array.from({ length: 10_000 }, (_, n) => ({ studentId: String(2000000000 + n), name: `학생${n}` }))
    const body = roster({ members })
    assert.ok(JSON.stringify(body).length > 32_768)
    const result = await env.ok<FeeSettingsResponse>(env.request('POST', '/dues-roster', body))
    assert.equal(result.roster!.members.length, 10_000)
    assert.equal(await memberCount(env), 10_000)
  } finally { await env.pg.close() }
})

test('참가비 설정 본문이 틀리면 인증 전에 400으로 거절한다', async () => {
  const env = await setupPurchases()
  try {
    env.as(null)
    const accounts = [{ ...account(), bank: undefined }, { ...account(), version: undefined }, account({ bank: '   ' }), account({ bank: '😀'.repeat(21) }),
      account({ holder: '' }), account({ holder: '😀'.repeat(31) }), account({ holder: `학생회${nul}` }), account({ holder: `학생회${lone}` }),
      account({ accountNumber: '1234567' }), account({ accountNumber: `12345678${nul}` }), account({ version: -1 }), account({ extra: 1 })]
    for (const body of accounts) await refused(env.request('POST', '/fee-account', body), 400, 'INVALID_INPUT', JSON.stringify(body).slice(0, 80))
    const rosters = [{ ...roster(), members: undefined }, { ...roster(), useUntil: undefined }, roster({ label: '   ' }), roster({ label: '😀'.repeat(31) }),
      roster({ label: `명단${nul}` }), roster({ label: `명단${lone}` }), roster({ members: [] }), roster({ useUntil: '2999-02-30' }),
      roster({ members: [{ studentId: '2022000001', name: '   ' }] }), roster({ members: [{ studentId: '2022000001', name: '😀'.repeat(31) }] }),
      roster({ members: [{ studentId: '2022000001', name: `김${nul}` }] }), roster({ members: [{ studentId: '2022000001', name: `김${lone}` }] }),
      roster({ members: [{ studentId: '12345', name: '김바다' }] }), roster({ members: [{ studentId: '2022000001', name: '김바다', extra: 1 }] }),
      roster({ members: [{ studentId: '2022000001', name: '김바다' }, { studentId: '2022-000001', name: '김바다' }] }), roster({ extra: 1 })]
    for (const body of rosters) await refused(env.request('POST', '/dues-roster', body), 400, 'INVALID_INPUT', JSON.stringify(body).slice(0, 80))
    for (const body of [{ version: 0 }, {}, { version: 1, extra: 1 }]) {
      await refused(env.request('POST', '/dues-roster/delete', body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
  } finally { await env.pg.close() }
})
