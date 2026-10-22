// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AgreementGate from './AgreementGate'
import { getJson } from '@/lib/api'
import { agreementResponse } from '@/test-support/agreement-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'

const onLogout = vi.fn()
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  api = mockApi()
})
afterEach(() => {
  cleanup()
  try {
    api.assertNoUnexpectedRequests()
  } finally {
    vi.unstubAllGlobals()
    onLogout.mockReset()
  }
})

// 안쪽 화면: 눌러 학생회 요청을 보낸다. 그 요청이 막히면 게이트가 동의 화면으로 돌려보내야 한다.
function Inside() {
  return (
    <button
      type="button"
      onClick={() => {
        void getJson('/api/organizations/c1')
      }}
    >
      학생회 열기
    </button>
  )
}
const open = () =>
  render(
    <AgreementGate logoutBusy={false} onLogout={onLogout}>
      <Inside />
    </AgreementGate>,
  )
const needed = () => agreementResponse({ required: true })
const startButton = () => screen.getByRole('button', { name: '시작하기' })

test('동의가 필요하면 안쪽 화면보다 먼저 동의 화면이 보이고, 체크해야 시작하기가 켜진다', async () => {
  api.on('GET', '/api/me/agreement', () => json(needed()))
  open()
  await screen.findByText('이용약관에 동의합니다')
  expect(screen.queryByRole('button', { name: '학생회 열기' })).toBeNull()
  expect(startButton().hasAttribute('disabled')).toBe(true)
  for (const [name, href] of [
    ['약관 보기', 'https://docs.example.test/terms'],
    ['처리방침 보기', 'https://docs.example.test/privacy'],
  ] as const) {
    const link = screen.getByRole('link', { name })
    expect(link.getAttribute('href')).toBe(href)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  }
  fireEvent.click(screen.getByRole('checkbox', { name: '이용약관에 동의합니다' }))
  expect(startButton().hasAttribute('disabled')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  expect(onLogout).toHaveBeenCalledOnce()
})

test('동의하면 지금 판을 보내고 안쪽 화면으로 간다. 두 번 눌러도 한 번만 보낸다', async () => {
  api.on('GET', '/api/me/agreement', () => json(needed()))
  const pending = deferredResponse()
  api.on('POST', '/api/me/agreement', () => pending.promise)
  open()
  fireEvent.click(await screen.findByRole('checkbox'))
  fireEvent.click(startButton())
  const busyButton = screen.getByRole('button', { name: '확인 중…' })
  expect(busyButton.hasAttribute('disabled')).toBe(true)
  fireEvent.click(busyButton)
  pending.resolve(json(agreementResponse({ required: true, agreed: true })))
  await screen.findByRole('button', { name: '학생회 열기' })
  const posts = api.calls.filter(call => call.method === 'POST')
  expect(posts.map(call => call.body)).toEqual([
    { termsVersion: '2026-11-01', privacyVersion: '2026-11-01' },
  ])
})

test('동의가 필요 없으면 동의 화면 없이 안쪽 화면이 보인다', async () => {
  api.on('GET', '/api/me/agreement', () => json(agreementResponse()))
  open()
  await screen.findByRole('button', { name: '학생회 열기' })
  expect(screen.queryByText('이용약관에 동의합니다')).toBeNull()
})

test('이미 동의했으면 동의 화면이 보이지 않는다', async () => {
  api.on('GET', '/api/me/agreement', () =>
    json(agreementResponse({ required: true, agreed: true })),
  )
  open()
  await screen.findByRole('button', { name: '학생회 열기' })
  expect(screen.queryByText('이용약관에 동의합니다')).toBeNull()
})

test('동의 상태를 읽지 못하면 막지 않고 안쪽 화면을 보인다(막는 일은 서버가 한다)', async () => {
  api.on('GET', '/api/me/agreement', () => json({ error: 'x' }, 500))
  open()
  await screen.findByRole('button', { name: '학생회 열기' })
})

test('쓰는 중 403 TERMS_REQUIRED가 오면 동의 화면으로 간다', async () => {
  let required = false
  api.on('GET', '/api/me/agreement', () => json(required ? needed() : agreementResponse()))
  api.on('GET', '/api/organizations/c1', () => json({ error: 'TERMS_REQUIRED' }, 403))
  open()
  required = true
  fireEvent.click(await screen.findByRole('button', { name: '학생회 열기' }))
  await screen.findByText('이용약관에 동의합니다')
  expect(screen.queryByRole('button', { name: '학생회 열기' })).toBeNull()
})

test('다른 403은 동의 화면으로 보내지 않는다', async () => {
  api.on('GET', '/api/me/agreement', () => json(agreementResponse()))
  api.on('GET', '/api/organizations/c1', () => json({ error: 'FORBIDDEN' }, 403))
  open()
  fireEvent.click(await screen.findByRole('button', { name: '학생회 열기' }))
  await settle()
  expect(api.calls.filter(call => call.path === '/api/me/agreement')).toHaveLength(1)
  expect(screen.getByRole('button', { name: '학생회 열기' })).toBeTruthy()
})

test('409 TERMS_OUTDATED면 판을 다시 읽고, 체크를 풀고, 문구를 보인다', async () => {
  let version = '2026-11-01'
  api.on('GET', '/api/me/agreement', () =>
    json(agreementResponse({ required: true, termsVersion: version })),
  )
  api.on('POST', '/api/me/agreement', () => {
    version = '2026-12-01'
    return json({ error: 'TERMS_OUTDATED' }, 409)
  })
  open()
  fireEvent.click(await screen.findByRole('checkbox'))
  fireEvent.click(startButton())
  await screen.findByText('약관이 바뀌었어요. 새 내용을 확인하고 다시 동의해 주세요.')
  const box = screen.getByRole<HTMLInputElement>('checkbox')
  expect(box.checked).toBe(false)
  expect(startButton().hasAttribute('disabled')).toBe(true)
  fireEvent.click(box)
  api.on('POST', '/api/me/agreement', () =>
    json(agreementResponse({ required: true, agreed: true, termsVersion: version })),
  )
  fireEvent.click(startButton())
  await screen.findByRole('button', { name: '학생회 열기' })
  expect(api.calls.at(-1)?.body).toEqual({
    termsVersion: '2026-12-01',
    privacyVersion: '2026-11-01',
  })
})

test('저장에 실패하면 버튼 옆에 문구가 보이고 다시 누를 수 있다', async () => {
  api.on('GET', '/api/me/agreement', () => json(needed()))
  api.on('POST', '/api/me/agreement', () => json({ error: 'Internal' }, 500))
  open()
  fireEvent.click(await screen.findByRole('checkbox'))
  fireEvent.click(startButton())
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('동의를 저장하지 못했어요')
  await waitFor(() => expect(startButton().hasAttribute('disabled')).toBe(false))
})

test('403으로 막힌 뒤 동의 상태를 읽지 못하면 안내와 다시 시도가 보이고, 읽으면 동의 화면이 된다', async () => {
  let reads = 0
  api.on('GET', '/api/me/agreement', () =>
    ++reads === 2 ? json({ error: 'x' }, 500) : json(reads === 1 ? agreementResponse() : needed()),
  )
  api.on('GET', '/api/organizations/c1', () => json({ error: 'TERMS_REQUIRED' }, 403))
  open()
  fireEvent.click(await screen.findByRole('button', { name: '학생회 열기' }))
  await screen.findByText('동의 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await screen.findByText('이용약관에 동의합니다')
})
