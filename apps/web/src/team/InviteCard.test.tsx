// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { asElement } from '@/test-support/elements'
import InviteCard from './InviteCard'

// 코드 바꾸기 전 확인 창(기능 020 정한 것 14).
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  api = mockApi()
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
})
afterEach(() => {
  cleanup()
  try {
    api.assertNoUnexpectedRequests()
  } finally {
    vi.unstubAllGlobals()
  }
})
const rotations = () => api.calls.filter(call => call.method === 'POST')

async function askRotate() {
  render(<InviteCard councilId="c1" onForbidden={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: '코드 바꾸기' }))
  return screen.getByRole('dialog', { name: '초대 코드를 바꿀까요?' })
}

test('[코드 바꾸기]는 확인 창을 열고 [닫기]면 바꾸지 않는다', async () => {
  const dialog = await askRotate()
  expect(
    within(dialog).getByText(
      '옛 링크와 코드로는 들어올 수 없어요. 이미 들어온 운영진은 그대로예요.',
    ),
  ).toBeTruthy()
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(rotations()).toHaveLength(0)
})

test('확인 창의 [코드 바꾸기]는 보내는 동안 막히고, 바뀌면 창을 닫고 새 링크를 보인다', async () => {
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/invite/rotate', () => pending.promise)
  const dialog = await askRotate()
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  expect(rotations()).toHaveLength(1)
  pending.resolve(json({ code: 'WXYZ6789' }))
  expect(
    await screen.findByText('코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.'),
  ).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  const link = asElement(screen.getByRole('textbox', { name: '초대 링크' }), HTMLInputElement)
  expect(link.value).toContain('/join/WXYZ6789')
})
