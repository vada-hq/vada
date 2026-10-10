// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { MyRegistration } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import PublicApp from './PublicApp'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.location.hash = '' })
const first = 'Ab3_-xYz0123456789abcd'
const second = 'Zz9_-xYz0123456789abcd'
const mine = (name: string): MyRegistration => ({ code: 'ABCD2345', organizationName: '학생회', event: { name: '체육대회', startsAt: null, endsAt: null,
  place: null }, name, studentId: '2022123456', phone: null, createdAt: '2026-08-02T14:05', closesAt: '2026-08-19T23:59', cancelled: false,
  cancellable: true, payment: null })

test('내 신청 화면은 주소의 # 뒤가 바뀌면 새 토큰으로 다시 불러온다', async () => {
  const api = mockApi()
  api.on('POST', '/api/public/registrations/lookup', call => json(mine((call.body as { token: string }).token === first ? '김바다' : '이수강')))
  window.location.hash = first
  render(<PublicApp route={{ kind: 'mine' }} />)
  expect(await screen.findByText('김바다')).toBeTruthy()
  window.location.hash = second
  expect(await screen.findByText('이수강')).toBeTruthy()
  expect(api.calls.map(call => call.body)).toEqual([{ token: first }, { token: second }])
})
