import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACCOUNT_LIST_LIMIT } from '@vada/contracts'
import { BODY, withAccounts } from '../test-support/accounts.js'

test(
  '모든 운영진이 계좌를 본다. 닫지 않은 것(대표 먼저, 이름 순) 뒤에 닫은 것(최근에 닫은 순)이 닫은 날과 온다',
  withAccounts(async t => {
    const sub = await t.make({ name: '나 사업' })
    const alpha = await t.make({ name: '가 사업' })
    const main = await t.make({ name: '다 대표', type: 'main' })
    const old = await t.make({ name: '옛것' })
    const recent = await t.make({ name: '최근것' })
    await t.change(old, { closedOn: '2026-03-01' })
    await t.change(recent, { closedOn: '2026-09-01' })
    await t.make({ name: '남의 것' }, t.other)
    for (const user of ['s-president', 's-planningMember', 's-plain', 's-financeMember']) {
      const { status, body } = await t.list(user)
      assert.equal(status, 200, user)
      assert.deepEqual(
        body.accounts.map(account => account.id),
        [main, alpha, sub, recent, old],
        user,
      )
      assert.equal(body.truncated, false)
    }
    const { body } = await t.list('s-president')
    assert.equal(body.accounts[0]!.closedOn, null)
    assert.equal(body.accounts[3]!.closedOn, '2026-09-01')
    // 동작은 재정부만 받고 닫은 계좌에는 없다.
    assert.deepEqual(
      body.accounts.map(account => account.actions),
      [[], [], [], [], []],
    )
    assert.deepEqual(
      (await t.list()).body.accounts.map(account => account.actions.length),
      [1, 1, 1, 0, 0],
    )
  }),
)

test(
  '목록은 상한을 넘으면 truncated이고, 로그인하지 않으면 401, 다른 학생회와 내보낸 사람은 403이다',
  withAccounts(async t => {
    for (let index = 0; index < ACCOUNT_LIST_LIMIT + 1; index++)
      await t.make({ name: `계좌${String(index).padStart(3, '0')}` })
    const { body } = await t.list()
    assert.equal(body.accounts.length, ACCOUNT_LIST_LIMIT)
    assert.equal(body.truncated, true)
    assert.equal((await t.api.get(t.base)).status, 401)
    assert.equal((await t.api.get(t.base, 'o-financeMember')).status, 403)
    assert.equal((await t.api.get(t.base, 's-ended')).status, 403)
  }),
)

test(
  '응답은 no-store이고 거절한 요청이 계좌번호를 로그에 남기지 않는다',
  withAccounts(async t => {
    const logged: string[] = []
    const originals = { log: console.log, error: console.error, warn: console.warn }
    for (const name of ['log', 'error', 'warn'] as const)
      console[name] = (...args: unknown[]) => void logged.push(args.map(String).join(' '))
    try {
      const { response } = await t.list()
      assert.equal(response.headers.get('cache-control'), 'no-store')
      await t.created()
      await t.post('', BODY)
      await t.post('', { ...BODY, accountNumber: 'abc' })
    } finally {
      Object.assign(console, originals)
    }
    assert.ok(!logged.join('\n').includes(BODY.accountNumber))
    assert.ok(!logged.join('\n').includes(BODY.holder))
  }),
)
