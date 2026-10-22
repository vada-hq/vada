import assert from 'node:assert/strict'
import { test } from 'node:test'
import { uniqueViolationOf } from '../db/error-code.js'
import { withAccounts } from '../test-support/accounts.js'

const violationOf = async (run: () => Promise<unknown>) => {
  try {
    await run()
  } catch (error) {
    return uniqueViolationOf(error)
  }
  return undefined
}

// 서비스가 미리 보지 못한 겹침(동시 처리)은 DB 유일 제약이 막고, 서비스는 제약 이름으로 오류 코드를 가른다.
// 이름이 바뀌면 service.ts의 NAME_CONSTRAINT가 어긋나 이름 겹침이 대표 겹침으로 잘못 나오므로 여기서 붙잡는다.
test(
  'DB가 같은 이름과 둘째 대표 계좌를 서비스가 아는 제약 이름으로 거절한다',
  withAccounts(async t => {
    await t.make({ name: '대표', type: 'main' })
    assert.equal(await violationOf(() => t.make({ name: '대표' })), 'account_council_id_name_key')
    const second = await violationOf(() => t.make({ name: '둘째 대표', type: 'main' }))
    assert.ok(second && second !== 'account_council_id_name_key', String(second))
    // 닫은 대표는 세지 않고, 다른 학생회는 상관없다.
    await t.make({ name: '옛 대표', type: 'main', closedOn: '2026-01-01' })
    await t.make({ name: '대표', type: 'main' }, t.other)
  }),
)
