// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { meetingSample, MEETING_COUNCIL, MEETING_ID } from './test-support/meeting-samples'
import { minutesDrafts, resetKeptMinutes } from './minutes-drafts'

const base = `/api/organizations/${MEETING_COUNCIL}/meetings/${MEETING_ID}`
const A = '0199d1a0-0000-7000-8000-00000000aaa1'
const B = '0199d1a0-0000-7000-8000-00000000bbb1'
const settle = () => new Promise(done => setTimeout(done, 0))
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  api = mockApi()
})
afterEach(() => {
  resetKeptMinutes()
  api.assertNoUnexpectedRequests()
})
const posts = () => api.calls.filter(c => c.method === 'POST')

test('화면을 떠난 뒤 늦은 응답이 와도 그사이 친 글을 보내지 않고, 같은 사람에게만 되살린다', async () => {
  const meeting = meetingSample({ status: 'in_progress', actions: ['meeting.minutes'] })
  const id = meeting.agenda[0]!.id
  const pending = deferredResponse()
  api.on('POST', `${base}/agenda/${id}`, () => pending.promise)
  const store = minutesDrafts(base, meeting, A)
  store.attach(() => {})
  store.change(id, '첫 글')
  void store.save(id)
  store.change(id, '첫 글과 추가 입력')
  store.detach()
  const saved = {
    ...meeting,
    agenda: [{ ...meeting.agenda[0]!, notes: '첫 글', versionNo: 2 }],
  }
  pending.resolve(json({ meeting: saved }))
  await settle()
  await settle()
  expect(posts()).toHaveLength(1)
  const other = minutesDrafts(base, saved, B)
  expect(other.snapshot().get(id)!.text).toBe('첫 글')
  const again = minutesDrafts(base, saved, A)
  expect(again.snapshot().get(id)!.text).toBe('첫 글과 추가 입력')
  expect(again.snapshot().get(id)!.version).toBe(2)
})

test('떠날 때 저장이 실패한 초안은 같은 사람이 회의를 다시 열면 되살아난다', async () => {
  const meeting = meetingSample({ status: 'in_progress', actions: ['meeting.minutes'] })
  const id = meeting.agenda[0]!.id
  api.on('POST', `${base}/agenda/${id}`, () => json({ error: 'FAILED' }, 500))
  const store = minutesDrafts(base, meeting, A)
  store.attach(() => {})
  store.change(id, '떠나기 직전 글')
  store.detach()
  await settle()
  await settle()
  expect(posts()).toHaveLength(1)
  expect(minutesDrafts(base, meeting, A).snapshot().get(id)!.text).toBe('떠나기 직전 글')
  expect(minutesDrafts(base, meeting, B).snapshot().get(id)!.text).toBe(
    meeting.agenda[0]!.notes ?? '',
  )
})

test('빠진 안건에 남긴 초안은 다시 열 때 옮겨 쓸 글로 보인다', async () => {
  const meeting = meetingSample({ status: 'in_progress', actions: ['meeting.minutes'] })
  const id = meeting.agenda[0]!.id
  api.on('POST', `${base}/agenda/${id}`, () => json({ error: 'NOT_FOUND' }, 404))
  const store = minutesDrafts(base, meeting, A)
  store.attach(() => {})
  store.change(id, '빠진 곳의 글')
  store.detach()
  await settle()
  await settle()
  const removed = { ...meeting, agenda: [] }
  expect(minutesDrafts(base, removed, A).lostTexts()).toEqual(['빠진 곳의 글'])
  expect(minutesDrafts(base, removed, B).lostTexts()).toEqual([])
})

test('늦게 끝난 앞 화면의 저장은 다시 연 화면이 남긴 새 초안을 지우지 않는다', async () => {
  const meeting = meetingSample({ status: 'in_progress', actions: ['meeting.minutes'] })
  const id = meeting.agenda[0]!.id
  const late = deferredResponse()
  let calls = 0
  api.on('POST', `${base}/agenda/${id}`, () => {
    calls += 1
    return calls === 1 ? late.promise : json({ error: 'FAILED' }, 500)
  })
  const first = minutesDrafts(base, meeting, A)
  first.attach(() => {})
  first.change(id, '앞 화면 글')
  first.detach()
  const second = minutesDrafts(base, meeting, A)
  second.attach(() => {})
  second.change(id, '다시 연 화면의 새 글')
  second.detach()
  await settle()
  await settle()
  const saved = {
    ...meeting,
    agenda: [{ ...meeting.agenda[0]!, notes: '앞 화면 글', versionNo: 2 }],
  }
  late.resolve(json({ meeting: saved }))
  await settle()
  await settle()
  expect(minutesDrafts(base, saved, A).snapshot().get(id)!.text).toBe('다시 연 화면의 새 글')
})
