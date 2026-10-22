// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FINANCE_PUSH_OFF, PUSH_OFF_CHAT, TASK_PUSH_OFF } from '@/lib/messages'
import { json, mockApi } from '@/test-support/mock-api'
import type { PushEnvironment } from '../push/usePush'
import type { Page } from './pages'
import PagePushBand from './PagePushBand'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const environment: PushEnvironment = {
  browser: {
    supported: true,
    permission: () => 'default',
    pushManager: async () => ({
      getSubscription: async () => null,
      subscribe: async () => {
        throw new Error('unused')
      },
    }),
  },
  device: 'android',
  homeScreenApp: false,
}

function show(page: Page) {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ publicKey: 'BAECAw' }))
  render(<PagePushBand page={page} environment={environment} />)
}

test('업무 화면에서는 업무에 맞는 문구를 보인다', async () => {
  show('tasks')
  expect(await screen.findByText(TASK_PUSH_OFF)).toBeTruthy()
  expect(screen.queryByText(PUSH_OFF_CHAT)).toBeNull()
})

test('대화 화면에서는 기존 문구를 보인다', async () => {
  show('chat')
  expect(await screen.findByText(PUSH_OFF_CHAT)).toBeTruthy()
})

test('홈 화면에서도 기본 문구로 보인다', async () => {
  show('home')
  expect(await screen.findByText(PUSH_OFF_CHAT)).toBeTruthy()
})

test('다른 화면에서는 띠가 없다', async () => {
  show('people')
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByText(/휴대폰 알림이 꺼져 있어요/)).toBeNull()
})

test('재정 화면에서는 새 요청과 결재 결과에 맞는 문구를 보인다', async () => {
  show('finance')
  expect(await screen.findByText(FINANCE_PUSH_OFF)).toBeTruthy()
  expect(screen.queryByText(PUSH_OFF_CHAT)).toBeNull()
})
