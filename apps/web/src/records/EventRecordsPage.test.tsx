// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import EventRecordsPage from './EventRecordsPage'
import {
  RECORD_COUNCIL,
  RECORD_EVENT,
  recordItem,
  recordSample,
} from './test-support/record-samples'

const base = `/api/organizations/${RECORD_COUNCIL}/records/events`
let api: ReturnType<typeof mockApi>
const forbidden = vi.fn()
// 기록 메뉴는 모든 운영진이 본다. 동작 권한이 하나도 없어도 읽기는 같다.
const page = () => (
  <EventRecordsPage
    view={councilView(RECORD_COUNCIL, { permissions: [] })}
    onForbidden={forbidden}
  />
)

beforeEach(() => {
  api = mockApi()
  api.on('GET', base, () => json({ events: [recordItem()], truncated: false }))
  api.on('GET', `${base}/${RECORD_EVENT}`, () => json({ record: recordSample() }))
})
afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  window.history.replaceState(null, '', '/')
  forbidden.mockReset()
  vi.unstubAllGlobals()
})

test('목록에서 [상세 보기]를 누르면 행사 기록 주소로 가서 상세를 읽는다', async () => {
  window.history.replaceState(null, '', `/records/${RECORD_COUNCIL}`)
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: /상세 보기/ }))
  expect(window.location.pathname).toBe(`/records/${RECORD_COUNCIL}/${RECORD_EVENT}`)
  expect(await screen.findByRole('navigation', { name: '목차' })).toBeTruthy()
})

test('행사 기록 주소로 바로 열어도(새로고침) 상세다', async () => {
  window.history.replaceState(null, '', `/records/${RECORD_COUNCIL}/${RECORD_EVENT}`)
  render(page())
  expect(await screen.findByRole('region', { name: '성과' })).toBeTruthy()
  expect(api.calls.some(call => call.path === base)).toBe(false)
})

test('완료하지 않았거나 없는 행사(404)면 알리고 완료된 행사 목록으로 돌아간다', async () => {
  api.on('GET', `${base}/${RECORD_EVENT}`, () => json({ error: 'NOT_FOUND' }, 404))
  window.history.replaceState(null, '', `/records/${RECORD_COUNCIL}/${RECORD_EVENT}`)
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '완료된 행사' }))
  expect(window.location.pathname).toBe(`/records/${RECORD_COUNCIL}`)
  expect(await screen.findByRole('button', { name: /상세 보기/ })).toBeTruthy()
})

test('운영진이 아니게 되었으면(403) 학생회를 다시 읽게 한다', async () => {
  api.on('GET', base, () => json({ error: 'FORBIDDEN' }, 403))
  window.history.replaceState(null, '', `/records/${RECORD_COUNCIL}`)
  render(page())
  await vi.waitFor(() => expect(forbidden).toHaveBeenCalled())
})
