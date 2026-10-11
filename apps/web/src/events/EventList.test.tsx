// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import EventList from './EventList'

afterEach(cleanup)
test('marks the active event and delegates selection without fetching', () => {
  const event = { id: 'e1', organizationId: 'o1', name: '체육대회', createdBy: 'u1', createdAt: '2026-09-29T00:00:00Z', startsAt: null, endsAt: null, place: null, version: 1, completedAt: null,
    ownerDepartment: null, owner: null }
  const onSelect = vi.fn()
  render(<EventList events={[event]} loading={false} saving={false} error="" selectedId="e1" onSelect={onSelect} onRefresh={() => {}} />)
  const button = screen.getByRole('button', { name: '체육대회' })
  expect(button.getAttribute('aria-current')).toBe('page')
  fireEvent.click(button)
  expect(onSelect).toHaveBeenCalledWith(event)
})

test('the new event button waits for the list and stays off when the list failed', () => {
  const base = { events: null, saving: false, error: '', onSelect: () => {}, onRefresh: () => {}, onCreate: () => {} }
  const view = render(<EventList {...base} loading />)
  expect((screen.getByRole('button', { name: '새 행사' }) as HTMLButtonElement).disabled).toBe(true)
  view.rerender(<EventList {...base} loading={false} error="행사 목록을 불러오지 못했어요." />)
  expect((screen.getByRole('button', { name: '새 행사' }) as HTMLButtonElement).disabled).toBe(true)
  view.rerender(<EventList {...base} loading={false} events={[]} />)
  expect((screen.getByRole('button', { name: '새 행사' }) as HTMLButtonElement).disabled).toBe(false)
})
