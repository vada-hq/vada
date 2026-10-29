// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { EVENT_ID } from '@/test-support/event-fixtures'
import { deferredResponse, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import type { Page } from './pages'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

test.each<[Page, string, string]>([
  ['home', `/home/${COUNCIL_ID}`, 'max-w-7xl'],
  ['settings', `/settings/${COUNCIL_ID}`, 'max-w-3xl'],
  ['events', `/events/${COUNCIL_ID}`, 'max-w-7xl'],
  ['events', `/events/${COUNCIL_ID}/${EVENT_ID}`, 'max-w-7xl'],
  ['chat', `/chat/${COUNCIL_ID}`, 'max-w-7xl'],
  ['council', `/council/${COUNCIL_ID}`, 'max-w-7xl'],
  ['tasks', `/tasks/${COUNCIL_ID}`, 'max-w-7xl'],
  ['calendar', `/calendar/${COUNCIL_ID}`, 'max-w-7xl'],
])('%s는 불러오는 중에도 머리글과 본문이 같은 가운데 폭이다(%s)', (page, path, width) => {
  const api = mockApi()
  const pending = deferredResponse()
  api.on('GET', `/api/organizations/${COUNCIL_ID}`, () => pending.promise)
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => pending.promise)
  window.history.replaceState(null, '', path)
  render(<WorkspaceAt startPage={page} />)
  const header = screen.getByRole('banner')
  const main = screen.getByRole('main')
  expect(screen.getByText('학생회 불러오는 중…')).toBeTruthy()
  for (const frame of [header.firstElementChild!, main.firstElementChild!]) {
    expect(frame.className.split(' ')).toEqual(expect.arrayContaining(['mx-auto', 'w-full', width]))
  }
  for (const scrollArea of [header, main]) {
    expect(scrollArea.className).toContain('md:scrollbar-gutter-stable')
  }
  if (page === 'chat' || page === 'council') {
    expect(main.firstElementChild!.className.split(' ')).toEqual(
      expect.arrayContaining(['h-full', 'min-h-0']),
    )
    expect(main.className).not.toMatch(/\bp-4\b|\bsm:p-6\b/)
  }
  api.assertNoUnexpectedRequests()
})
