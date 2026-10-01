// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import EventList from './EventList'

afterEach(cleanup)
test('marks the active event and delegates selection without fetching', () => {
  const event = { id: 'e1', organizationId: 'o1', name: '체육대회', createdBy: 'u1', createdAt: '2026-09-29T00:00:00Z' }
  const onSelect = vi.fn()
  render(<EventList events={[event]} loading={false} saving={false} error="" selectedId="e1" onSelect={onSelect} onRefresh={() => {}} />)
  const button = screen.getByRole('button', { name: '체육대회' })
  expect(button.getAttribute('aria-current')).toBe('page')
  fireEvent.click(button)
  expect(onSelect).toHaveBeenCalledWith(event)
})
