// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { asElement } from '@/test-support/elements'
import { qrMatrix, qrPath } from '@/lib/qr-code'
import { InviteSheet, InviteSheetBody } from './InviteSheet'

// 구성원 초대 창(기능 023 조각 6)의 안: 링크와 코드를 따로 복사하고, 코드 바꾸기는 확인 창을 거친다(기능 020 정한 것 14).
const FIRST = { code: 'ABCD2345', createdAt: '2026-10-25T05:00:00.000Z' }
const NEXT = { code: 'WXYZ6789', createdAt: '2026-10-26T01:30:00.000Z' }
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
  api = mockApi()
  api.on('GET', '/api/organizations/c1/invite', () => json(FIRST))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  try {
    api.assertNoUnexpectedRequests()
  } finally {
    vi.unstubAllGlobals()
  }
})
const rotations = () => api.calls.filter(call => call.method === 'POST')
// 확인 창이 열려 있으면 뒤의 초대 창은 숨겨진다(aria-hidden). 그래도 칸의 값을 본다.
const valueOf = (name: string) =>
  asElement(screen.getByRole('textbox', { name, hidden: true }), HTMLInputElement).value

function show(onForbidden = () => {}) {
  render(
    <InviteSheet open onOpenChange={() => {}}>
      <InviteSheetBody councilId="c1" onForbidden={onForbidden} />
    </InviteSheet>,
  )
  return screen.getByRole('dialog', { name: '구성원 초대' })
}

async function askRotate() {
  const sheet = show()
  fireEvent.click(await within(sheet).findByRole('button', { name: '코드 바꾸기' }))
  return screen.getByRole('dialog', { name: '초대 코드를 바꿀까요?' })
}

test('닫힌 창은 초대 코드를 읽지 않는다', () => {
  render(
    <InviteSheet open={false} onOpenChange={() => {}}>
      <InviteSheetBody councilId="c1" onForbidden={() => {}} />
    </InviteSheet>,
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(api.calls).toHaveLength(0)
})

test('링크와 코드를 따로 보이고 따로 복사하며, 만든 시각을 보인다', async () => {
  const writeText = vi.fn(async (_text: string) => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const sheet = show()
  await within(sheet).findByRole('region', { name: '초대 링크' })
  expect(valueOf('초대 링크')).toBe(`${window.location.origin}/join/ABCD2345`)
  expect(valueOf('초대 코드')).toBe('ABCD2345')
  expect(within(sheet).getByText('만든 시각 10월 25일 (일) 14:00')).toBeTruthy()
  fireEvent.click(within(sheet).getByRole('button', { name: '코드 복사' }))
  expect(await within(sheet).findByText('초대 코드를 복사했어요.')).toBeTruthy()
  expect(writeText).toHaveBeenLastCalledWith('ABCD2345')
  fireEvent.click(within(sheet).getByRole('button', { name: '링크 복사' }))
  expect(await within(sheet).findByText('복사했어요')).toBeTruthy()
  expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/join/ABCD2345`)
})

const qrOf = (dialog: HTMLElement) =>
  within(dialog).getByRole('img', { name: '초대 링크 QR' }).querySelector('path')?.getAttribute('d')

test('[QR 보기]는 초대 링크와 같은 값의 QR을 창으로 크게 보인다', async () => {
  const sheet = show()
  fireEvent.click(await within(sheet).findByRole('button', { name: 'QR 보기' }))
  const dialog = screen.getByRole('dialog', { name: '초대 링크 QR' })
  expect(qrOf(dialog)).toBe(qrPath(qrMatrix(valueOf('초대 링크'))))
  expect(valueOf('초대 링크')).toBe(`${window.location.origin}/join/ABCD2345`)
  fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
  expect(screen.queryByRole('dialog', { name: '초대 링크 QR' })).toBeNull()
})

test('코드를 바꾸면 QR도 새 링크를 담는다', async () => {
  api.on('POST', '/api/organizations/c1/invite/rotate', () => json(NEXT))
  const dialog = await askRotate()
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  await screen.findByText('코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.')
  fireEvent.click(screen.getByRole('button', { name: 'QR 보기' }))
  const qr = screen.getByRole('dialog', { name: '초대 링크 QR' })
  expect(qrOf(qr)).toBe(qrPath(qrMatrix(`${window.location.origin}/join/WXYZ6789`)))
})

test('복사하지 못하면 칸을 직접 고르라고 알린다', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) },
    configurable: true,
  })
  const sheet = show()
  fireEvent.click(await within(sheet).findByRole('button', { name: '코드 복사' }))
  expect(
    await within(sheet).findByText('복사하지 못했어요. 칸을 직접 선택해 복사해 주세요.'),
  ).toBeTruthy()
})

test('[코드 바꾸기]는 확인 창을 열고 [닫기]면 바꾸지 않는다', async () => {
  const dialog = await askRotate()
  expect(
    within(dialog).getByText(
      '옛 링크와 코드로는 들어올 수 없어요. 이미 들어온 운영진은 그대로예요.',
    ),
  ).toBeTruthy()
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  expect(screen.queryByRole('dialog', { name: '초대 코드를 바꿀까요?' })).toBeNull()
  expect(rotations()).toHaveLength(0)
})

test('확인 창의 [코드 바꾸기]는 보내는 동안 막히고, 바뀌면 창을 닫고 새 링크·코드·시각을 보인다', async () => {
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/invite/rotate', () => pending.promise)
  const dialog = await askRotate()
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  expect(rotations()).toHaveLength(1)
  pending.resolve(json(NEXT))
  expect(
    await screen.findByText('코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.'),
  ).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: '초대 코드를 바꿀까요?' })).toBeNull()
  expect(valueOf('초대 링크')).toContain('/join/WXYZ6789')
  expect(valueOf('초대 코드')).toBe('WXYZ6789')
  expect(screen.getByText('만든 시각 10월 26일 (월) 10:30')).toBeTruthy()
})

test('바꾸지 못하면 확인 창이 남아 까닭을 보이고, 다시 누르면 바꾼다', async () => {
  let attempts = 0
  api.on('POST', '/api/organizations/c1/invite/rotate', () =>
    attempts++ === 0 ? json({ error: 'Internal server error' }, 500) : json(NEXT),
  )
  const dialog = await askRotate()
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  expect(
    await within(dialog).findByText('코드를 바꾸지 못했어요. 다시 시도해 주세요.'),
  ).toBeTruthy()
  expect(valueOf('초대 코드')).toBe('ABCD2345')
  fireEvent.click(within(dialog).getByRole('button', { name: '코드 바꾸기' }))
  expect(
    await screen.findByText('코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.'),
  ).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: '초대 코드를 바꿀까요?' })).toBeNull()
})

test('읽지 못하면 다시 시도할 수 있고, 403이면 학생회를 다시 읽게 한다', async () => {
  let reads = 0
  api.on('GET', '/api/organizations/c1/invite', () =>
    reads++ === 0 ? json({ error: 'Internal server error' }, 500) : json(FIRST),
  )
  const sheet = show()
  expect(within(sheet).queryByRole('button', { name: 'QR 보기' })).toBeNull()
  expect(await within(sheet).findByText('초대 링크를 불러오지 못했어요.')).toBeTruthy()
  expect(within(sheet).queryByRole('button', { name: 'QR 보기' })).toBeNull()
  fireEvent.click(within(sheet).getByRole('button', { name: '다시 시도' }))
  expect(await within(sheet).findByRole('textbox', { name: '초대 코드' })).toBeTruthy()
  cleanup()
  api.on('GET', '/api/organizations/c1/invite', () => json({ error: 'FORBIDDEN' }, 403))
  const forbidden = vi.fn()
  show(forbidden)
  expect(await screen.findByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
  expect(forbidden).toHaveBeenCalledTimes(1)
})
