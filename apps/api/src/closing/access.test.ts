import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FiscalPeriodsResponse } from '@vada/contracts'
import { clockNow } from '../records/records.js'
import { closingPath, FINANCE, readClosing, readPeriods } from '../test-support/closing.js'
import { withSettlement } from '../test-support/settlement.js'

// 회계 기간 목록과 결산서 읽기의 권한·격리·형식(기능 009 조각 3).

const listPath = (councilId: string) => `/api/organizations/${councilId}/fiscal-periods`

test(
  '기간 목록: 시작이 늦은 순, 이전 기간, 지금 기간, 결산 상태. 모든 운영진이 본다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const old = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    await t.make(t.council, 'budget', { fiscalPeriodId: old })
    await t.pg.query('UPDATE fiscal_period SET previous_period_id = $1 WHERE id = $2', [
      old,
      period,
    ])
    await t.make(t.council, 'account_closing', {
      fiscalPeriodId: old,
      publishedAt: new Date('2026-09-05T03:00:00Z'),
    })
    // 다른 학생회의 기간은 보이지 않는다
    await t.budgetOf(t.other)
    for (const user of [FINANCE, 's-planningMember', 's-president']) {
      const periods = await readPeriods(t, user)
      assert.deepEqual(
        periods.map(p => [p.name, p.previousPeriodId, p.current, p.status, p.publishedAt]),
        [
          ['2026-2', old, true, 'draft', null],
          ['2026-1', null, false, 'published', '2026-09-05T03:00:00.000Z'],
        ],
        user,
      )
    }
  }),
)

test(
  '기간 목록의 지금 기간은 한국 날짜로 정한다: 끝일 23:59:59는 지금이고 +1초는 아니다',
  withSettlement(async t => {
    await t.make(t.council, 'fiscal_period', {
      name: '10월',
      startsOn: '2026-10-01',
      endsOn: '2026-10-31',
    })
    const currentAt = async (value: string) => {
      t.setNow(new Date(value))
      return (await readPeriods(t))[0]?.current
    }
    assert.equal(await currentAt('2026-10-31T14:59:59Z'), true)
    assert.equal(await currentAt('2026-10-31T15:00:00Z'), false)
    assert.equal(await currentAt('2026-09-30T15:00:00Z'), true)
    assert.equal(await currentAt('2026-09-30T14:59:59Z'), false)
  }),
)

test(
  '목록: 로그인하지 않으면 401, 다른 학생회 사용자와 운영진이 아닌 사람은 403이다',
  withSettlement(async t => {
    assert.equal((await t.api.get(listPath(t.council.councilId))).status, 401)
    assert.equal((await t.api.get(listPath(t.council.councilId), 'o-financeMember')).status, 403)
    assert.equal((await t.api.get(listPath(t.council.councilId), 'nobody')).status, 403)
    assert.equal((await t.api.get(listPath('not-a-uuid'), FINANCE)).status, 403)
    const response = await t.api.get(listPath(t.council.councilId), FINANCE)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(((await response.json()) as FiscalPeriodsResponse).periods, [])
  }),
)

test(
  '공개 전 결산서는 재정부만 본다(회장단·부원 403). 공개 뒤에는 모든 운영진이 본다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    for (const user of ['s-president', 's-planningMember', 's-planningHead']) {
      assert.equal((await t.api.get(closingPath(t, period), user)).status, 403, user)
    }
    const draft = await readClosing(t, period)
    assert.deepEqual([draft.status, draft.publishedAt], ['draft', null])
    assert.deepEqual(draft.actions, [
      'closing.publish',
      'closing.export_public',
      'closing.export_audit',
    ])
    await t.make(t.council, 'account_closing', { fiscalPeriodId: period, publishedAt: clockNow })
    for (const user of ['s-president', 's-planningMember']) {
      const closing = await readClosing(t, period, user)
      assert.equal(closing.status, 'published', user)
      assert.deepEqual(closing.actions, ['closing.export_public'], user)
    }
    const finance = await readClosing(t, period)
    assert.deepEqual(finance.actions, [
      'closing.reopen',
      'closing.export_public',
      'closing.export_audit',
    ])
  }),
)

test(
  '결산서: 로그인하지 않으면 401, 다른 학생회 사용자는 403, 다른 학생회의 기간과 형식이 틀린 번호는 404다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const theirs = await t.budgetOf(t.other)
    assert.equal((await t.api.get(closingPath(t, period))).status, 401)
    assert.equal((await t.api.get(closingPath(t, period), 'o-financeMember')).status, 403)
    // 운영진이 아니면 번호 형식과 상관없이 403이다(대상이 있는지 드러내지 않는다)
    assert.equal((await t.api.get(closingPath(t, 'zzz'), 'o-financeMember')).status, 403)
    assert.equal((await t.api.get(closingPath(t, theirs.period), FINANCE)).status, 404)
    assert.equal((await t.api.get(closingPath(t, 'zzz'), FINANCE)).status, 404)
    assert.equal(
      (await t.api.get(closingPath(t, '00000000-0000-4000-8000-000000000000'), FINANCE)).status,
      404,
    )
    // 다른 학생회 쪽 길로 우리 기간을 읽을 수도 없다
    const other = closingPath(t, period, t.other.councilId)
    assert.equal((await t.api.get(other, 'o-financeMember')).status, 404)
    const response = await t.api.get(closingPath(t, period), FINANCE)
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }),
)
