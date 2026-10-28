import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ApplicantsResponse } from '@vada/contracts'
import { korean, withRegistrations } from '../test-support/registrations.js'

// 신청 양식 정책(기능 012 조각 3): 화면에 주는 actions와 서버의 거절이 같은 판정에서 나온다(자주 잡힌 것 11·12).

const PRESIDENT = 's-president'
const FINANCE = 's-financeMember'
const PLAIN = 's-plain'

test(
  '마감 경계는 ±1초: 마감 1초 전에는 멈출 수 있고 마감 시각부터 FORM_CLOSED이며 판이 생기지 않는다',
  withRegistrations(async t => {
    const { form } = await t.activeForm(await t.makeEvent())
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
    const { form } = await t.activeForm(event)
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
