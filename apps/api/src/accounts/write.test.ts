import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ACCOUNT_BANK_MAX,
  ACCOUNT_HOLDER_MAX,
  ACCOUNT_NAME_MAX,
  ACCOUNT_NUMBER_MAX,
} from '@vada/contracts'
import { BODY, MISSING, withAccounts } from '../test-support/accounts.js'

const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

test(
  '재정부가 계좌를 만들면 201, 판 1, 닫지 않은 상태이고 동작이 담긴다',
  withAccounts(async t => {
    const { status, account } = await t.created()
    assert.equal(status, 201)
    assert.deepEqual(
      { ...account, id: undefined },
      {
        ...BODY,
        id: undefined,
        closedOn: null,
        formsInUse: 0,
        actions: ['account.update', 'account.close'],
      },
    )
    assert.equal(await t.versions(account!.id), 1)
  }),
)

test(
  '회장단과 다른 부서와 직급 없는 운영진은 만들 수 없고 아무것도 남지 않는다',
  withAccounts(async t => {
    for (const user of ['s-president', 's-vicePresident', 's-planningHead', 's-plain'])
      assert.equal((await t.created({}, user)).status, 403, user)
    assert.equal(await t.accountCount(), 0)
    assert.equal(await t.count("SELECT count(*) AS n FROM record WHERE kind = 'account'"), 0)
  }),
)

test(
  '로그인하지 않으면 401, 다른 학생회 사람과 내보낸 운영진은 403이다',
  withAccounts(async t => {
    assert.equal((await t.api.post(t.base, BODY)).status, 401)
    assert.equal((await t.created({}, 'o-financeMember')).status, 403)
    assert.equal((await t.created({}, 's-ended')).status, 403)
    assert.equal(await t.accountCount(), 0)
  }),
)

const BAD: [string, Record<string, unknown>][] = [
  ['이름 없음', { name: undefined }],
  ['빈 이름', { name: '' }],
  ['공백 이름', { name: '   ' }],
  ['은행 없음', { bank: undefined }],
  ['계좌번호 없음', { accountNumber: undefined }],
  ['예금주 없음', { holder: undefined }],
  ['종류 없음', { type: undefined }],
  ['모르는 종류', { type: 'saving' }],
  ['이름 상한+1(이모지)', { name: '😀'.repeat(ACCOUNT_NAME_MAX + 1) }],
  ['은행 상한+1', { bank: '가'.repeat(ACCOUNT_BANK_MAX + 1) }],
  ['예금주 상한+1(이모지)', { holder: '😀'.repeat(ACCOUNT_HOLDER_MAX + 1) }],
  ['계좌번호 상한+1', { accountNumber: '1'.repeat(ACCOUNT_NUMBER_MAX + 1) }],
  ['계좌번호에 글자', { accountNumber: '123-45a' }],
  ['계좌번호에 공백', { accountNumber: '123 456' }],
  ['계좌번호에 전각 숫자', { accountNumber: '１２３' }],
  ['계좌번호가 하이픈뿐', { accountNumber: '---' }],
  ['이름에 NUL', { name: '운영\u0000비' }],
  ['예금주에 홀로 쓰인 서러게이트', { holder: '가\uD800' }],
  ['모르는 키', { extra: 1 }],
]
for (const [label, patch] of BAD)
  test(
    `입력이 틀리면 400이고 아무것도 남지 않는다: ${label}`,
    withAccounts(async t => {
      const response = await t.post('', { ...BODY, ...patch })
      assert.equal(response.status, 400)
      assert.equal(await t.accountCount(), 0)
    }),
  )

test(
  '상한은 받는다: 이름 20, 은행 20, 계좌번호 30, 예금주 60(이모지 포함)',
  withAccounts(async t => {
    const { status, account } = await t.created({
      name: '😀'.repeat(ACCOUNT_NAME_MAX),
      bank: '가'.repeat(ACCOUNT_BANK_MAX),
      accountNumber: '1'.repeat(ACCOUNT_NUMBER_MAX),
      holder: '😀'.repeat(ACCOUNT_HOLDER_MAX),
    })
    assert.equal(status, 201)
    assert.equal(Array.from(account!.holder).length, ACCOUNT_HOLDER_MAX)
  }),
)

test(
  '앞뒤 공백은 잘리고 계좌번호는 통장에 적힌 대로 하이픈을 남긴다',
  withAccounts(async t => {
    const { account } = await t.created({ name: '  운영비  ', accountNumber: ' 1-2-3 ' })
    assert.equal(account!.name, '운영비')
    assert.equal(account!.accountNumber, '1-2-3')
  }),
)

test(
  '같은 이름은 409 ACCOUNT_NAME_TAKEN이고 다른 학생회와는 겹쳐도 된다',
  withAccounts(async t => {
    await t.created()
    const again = await t.post('', BODY)
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'ACCOUNT_NAME_TAKEN')
    assert.equal(await t.accountCount(), 1)
    await t.make({ name: '운영비' }, t.other)
    assert.equal(await t.accountCount(), 2)
  }),
)

test(
  '닫지 않은 대표 계좌가 있으면 대표를 만들 수 없다(409 MAIN_ACCOUNT_EXISTS). 사업용은 얼마든지',
  withAccounts(async t => {
    assert.equal((await t.created({ name: '대표', type: 'main' })).status, 201)
    const second = await t.post('', { ...BODY, name: '대표2', type: 'main' })
    assert.equal(second.status, 409)
    assert.equal(await errorOf(second), 'MAIN_ACCOUNT_EXISTS')
    assert.equal((await t.created({ name: '사업1' })).status, 201)
    assert.equal((await t.created({ name: '사업2' })).status, 201)
    assert.equal(await t.accountCount(), 3)
    // 다른 학생회의 대표 계좌는 상관없다.
    await t.make({ name: '대표', type: 'main' }, t.other)
  }),
)

test(
  '대표를 닫으면 새 대표를 만들 수 있다',
  withAccounts(async t => {
    const main = (await t.created({ name: '대표', type: 'main' })).account!
    assert.equal((await t.post(`/${main.id}/close`, {})).status, 200)
    assert.equal((await t.created({ name: '새 대표', type: 'main' })).status, 201)
  }),
)

test(
  '고치기: 칸을 바꾸면 판이 하나 늘고 같은 값이면 늘지 않는다',
  withAccounts(async t => {
    const { account } = await t.created()
    const path = `/${account!.id}`
    const next = { ...BODY, bank: '신한은행', holder: '새 예금주' }
    const edited = await t.post(path, next)
    assert.equal(edited.status, 200)
    const body = (await edited.json()) as { account: { bank: string; holder: string } }
    assert.equal(body.account.bank, '신한은행')
    assert.equal(body.account.holder, '새 예금주')
    assert.equal(await t.versions(account!.id), 2)
    assert.equal((await t.post(path, next)).status, 200)
    assert.equal(await t.versions(account!.id), 2)
  }),
)

test(
  '고치기 거절: 회장 403, 이름 겹침과 대표 겹침 409, 자기 이름과 자기 대표는 괜찮다',
  withAccounts(async t => {
    const a = (await t.created({ name: '가' })).account!
    const b = (await t.created({ name: '나', type: 'main' })).account!
    assert.equal((await t.post(`/${a.id}`, BODY, 's-president')).status, 403)
    const taken = await t.post(`/${a.id}`, { ...BODY, name: '나' })
    assert.equal(await errorOf(taken), 'ACCOUNT_NAME_TAKEN')
    const toMain = await t.post(`/${a.id}`, { ...BODY, name: '가', type: 'main' })
    assert.equal(toMain.status, 409)
    assert.equal(await errorOf(toMain), 'MAIN_ACCOUNT_EXISTS')
    assert.equal((await t.post(`/${b.id}`, { ...BODY, name: '나', type: 'main' })).status, 200)
    // 대표를 사업용으로 바꾸면 그 뒤 다른 계좌가 대표가 될 수 있다.
    assert.equal((await t.post(`/${b.id}`, { ...BODY, name: '나' })).status, 200)
    assert.equal((await t.post(`/${a.id}`, { ...BODY, name: '가', type: 'main' })).status, 200)
    assert.equal(await t.versions(a.id), 2)
  }),
)

test(
  '닫기: 닫은 날이 한국 오늘로 남고 판이 하나 늘며, 다시 닫거나 고치면 409 ACCOUNT_CLOSED',
  withAccounts(async t => {
    // 한국 2026-10-26 00:00:00(UTC 10-25 15:00:00). 서버가 UTC 날짜를 쓰면 10-25로 어긋난다.
    t.setNow(new Date('2026-10-25T15:00:00Z'))
    const { account } = await t.created()
    const closed = await t.post(`/${account!.id}/close`, {})
    assert.equal(closed.status, 200)
    const body = (await closed.json()) as { account: { closedOn: string; actions: string[] } }
    assert.equal(body.account.closedOn, '2026-10-26')
    assert.deepEqual(body.account.actions, [])
    assert.equal(await t.versions(account!.id), 2)
    assert.equal(await errorOf(await t.post(`/${account!.id}/close`, {})), 'ACCOUNT_CLOSED')
    assert.equal(await errorOf(await t.post(`/${account!.id}`, BODY)), 'ACCOUNT_CLOSED')
    assert.equal(await t.versions(account!.id), 2)
  }),
)

test(
  '닫기는 재정부만, 본문에 모르는 키가 있으면 400이다',
  withAccounts(async t => {
    const { account } = await t.created()
    assert.equal((await t.post(`/${account!.id}/close`, {}, 's-president')).status, 403)
    assert.equal((await t.post(`/${account!.id}/close`, { x: 1 })).status, 400)
    assert.equal((await t.post(`/${account!.id}/close`, {}, 'o-financeMember')).status, 403)
    assert.equal(await t.versions(account!.id), 1)
  }),
)

test(
  '다른 학생회 계좌와 없는 계좌와 형식이 틀린 번호는 404이고 바뀌지 않는다',
  withAccounts(async t => {
    const foreign = await t.make({ name: '남의 것' }, t.other)
    for (const id of [foreign, MISSING, 'not-a-uuid']) {
      assert.equal((await t.post(`/${id}`, BODY)).status, 404, id)
      assert.equal((await t.post(`/${id}/close`, {})).status, 404, id)
    }
    assert.equal(await t.versions(foreign), 1)
    assert.equal((await t.post(`/${foreign}`, BODY, 's-president')).status, 403)
  }),
)
