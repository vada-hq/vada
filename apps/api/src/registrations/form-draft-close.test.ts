import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { RegistrationForm } from '@vada/contracts'
import { FORM, korean, withRegistrations } from '../test-support/registrations.js'

// 초안은 마감 없이 저장한다(행사 시작이 미정일 때). 활성화(멈춤 풀기)는 지금처럼 마감 없음을 막는다(DEC-93).
const DRAFT = { ...FORM, closesAt: null }
// 고치기는 칸을 모두 받는다.
const EDIT = {
  ...DRAFT,
  opensAt: null,
  capacity: null,
  notice: null,
  collectsStudentId: true,
  payerFee: null,
  nonPayerFee: null,
  feeAccountId: null,
}
const formOf = async (response: Response) =>
  ((await response.json()) as { form: RegistrationForm }).form
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

test(
  '마감 없는 초안을 만들고 고칠 수 있고, 활성화는 마감 없음을 409로 막는다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: null })
    const created = await t.create(event, DRAFT)
    assert.equal(created.status, 201)
    const form = await formOf(created)
    assert.deepEqual([form.closesAt, form.paused, form.status], [null, true, 'paused'])
    // 행사 일시도 마감도 없으면 지우는 날을 셀 근거가 없다.
    assert.equal(form.purgeOn, null)
    assert.deepEqual(form.missingConditions, ['event_starts_at', 'closes_at'])
    const stored = await t.pg.query<{ closes_at: unknown }>(
      'SELECT closes_at FROM registration_form WHERE id = $1',
      [form.id],
    )
    assert.equal(stored.rows[0]!.closes_at, null)
    for (const action of ['activate', 'resume']) {
      const response = await t.post(`/registration-forms/${form.id}/${action}`, {})
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), {
        error: 'FORM_NOT_READY',
        missingConditions: ['event_starts_at', 'closes_at'],
      })
    }
    // 마감을 채웠다가 다시 비워도 초안이면 된다. 판이 남는다.
    const filled = await t.editForm(form.id, {
      ...EDIT,
      closesAt: '2026-11-01T18:00',
    })
    assert.equal((await formOf(filled)).closesAt, '2026-11-01T18:00')
    const cleared = await t.editForm(form.id, EDIT)
    assert.equal(cleared.status, 200)
    assert.equal((await formOf(cleared)).closesAt, null)
    assert.equal(await t.versions(form.id), 3)
    assert.equal((await t.list(event)).forms[0]!.closesAt, null)
  }),
)

test(
  '행사 시작이 있으면 마감 없는 초안의 지우는 날은 행사 날로 센다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: korean('2026-11-05T14:00') })
    const form = await formOf(await t.create(event, DRAFT))
    assert.deepEqual([form.closesAt, form.purgeOn], [null, '2027-11-05'])
    assert.deepEqual(form.missingConditions, ['closes_at'])
  }),
)

test(
  '받는 중인 양식과 신청이 있는 멈춘 양식은 마감을 비울 수 없어 409이고 아무것도 바뀌지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: korean('2026-11-05T14:00') })
    const { form } = await t.activeForm(event)
    const before = await t.versions(form.id)
    const open = await t.editForm(form.id, EDIT)
    assert.equal(open.status, 409)
    assert.equal(await errorOf(open), 'CLOSES_AT_REQUIRED')
    await t.makeRegistration(form.id)
    assert.equal((await t.post(`/registration-forms/${form.id}/pause`, {})).status, 200)
    const paused = await t.editForm(form.id, EDIT)
    assert.equal(paused.status, 409)
    assert.equal(await errorOf(paused), 'CLOSES_AT_REQUIRED')
    assert.equal((await t.detail(form.id)).closesAt, FORM.closesAt)
    assert.equal(await t.versions(form.id), before + 1)
  }),
)

test(
  '신청을 모두 취소해도(환불 대기 포함) 받은 적 있는 양식은 마감을 비울 수 없다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: korean('2026-11-05T14:00') })
    const { form } = await t.activeForm(event)
    const id = await t.makeRegistration(form.id, { appliedFee: '5000' })
    await t.change('registration', id, { cancelledAt: new Date('2026-10-20T00:00:00Z') })
    assert.equal((await t.post(`/registration-forms/${form.id}/pause`, {})).status, 200)
    const response = await t.editForm(form.id, EDIT)
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'CLOSES_AT_REQUIRED')
  }),
)

test(
  'DB는 멈추지 않은 양식의 마감 비우기를 CHECK로 막는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await formOf(await t.create(event, DRAFT))
    await assert.rejects(
      t.pg.query('UPDATE registration_form SET paused_at = NULL WHERE id = $1', [form.id]),
    )
  }),
)
