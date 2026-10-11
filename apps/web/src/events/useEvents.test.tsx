// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useEvents } from './useEvents'
import EventList from './EventList'
import CreateEventForm from './CreateEventForm'

function Events({ organizationId }: { organizationId: string }) { return <Harness key={organizationId} organizationId={organizationId} /> }
function Harness({ organizationId }: { organizationId: string }) {
  const data = useEvents(organizationId)
  const [selected, setSelected] = useState('')
  return <><EventList events={data.events} loading={data.loading} error={data.loadError} saving={data.saving} onRefresh={data.refresh} onSelect={event => setSelected(event.name)} />
    <p>선택: {selected}</p><CreateEventForm name={data.name} onNameChange={data.setName} saving={data.saving} disabled={data.loading || Boolean(data.loadError)} error={data.createError} onSubmit={event => { void data.create(event) }} /></>
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const event = { id: 'e1', organizationId: 'o1', name: '체육대회', createdBy: 'u1', createdAt: '2026-09-29T00:00:00Z', startsAt: null, endsAt: null, place: null, version: 1, completedAt: null }
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

test('selects an event from the list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ events: [event] })))
  render(<Events organizationId="o1" />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  expect(screen.getByText('선택: 체육대회')).toBeTruthy()
})

test('loading, empty list and server order are displayed', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(ok({ events: [] })).mockResolvedValueOnce(ok({ events: [event] }))
  vi.stubGlobal('fetch', fetchMock)
  render(<Events organizationId="o1" />)
  expect(screen.getByRole('status').textContent).toContain('불러오는 중')
  expect(await screen.findByText('아직 행사가 없어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '목록 새로고침' }))
  expect(await screen.findByText('체육대회')).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/organizations/o1/events', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }))
})

test('blank names are blocked; creation trims the name and prevents duplicate submits', async () => {
  let resolve!: (value: unknown) => void
  const fetchMock = vi.fn().mockResolvedValueOnce(ok({ events: [] })).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  vi.stubGlobal('fetch', fetchMock)
  render(<Events organizationId="o1" />)
  await screen.findByText('아직 행사가 없어요.')
  const form = screen.getByRole('form', { name: '행사 만들기' })
  fireEvent.change(screen.getByLabelText('행사 이름'), { target: { value: '   ' } })
  fireEvent.submit(form)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('행사 이름'), { target: { value: '  체육대회  ' } })
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/o1/events', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: '체육대회' }) }))
  await act(async () => resolve(ok({ event })))
  expect(await screen.findByText('체육대회')).toBeTruthy()
  expect((screen.getByLabelText('행사 이름') as HTMLInputElement).value).toBe('')
})

test('list failure is not an empty list and supports retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce(ok({ events: [] })))
  render(<Events organizationId="o1" />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('아직 행사가 없어요.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '목록 새로고침' }))
  expect(await screen.findByText('아직 행사가 없어요.')).toBeTruthy()
})

test('failed creation retains input and does not claim success or retry automatically', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(ok({ events: [] })).mockRejectedValueOnce(new Error('private details'))
  vi.stubGlobal('fetch', fetchMock)
  render(<Events organizationId="o1" />)
  await screen.findByText('아직 행사가 없어요.')
  fireEvent.change(screen.getByLabelText('행사 이름'), { target: { value: '체육대회' } })
  fireEvent.click(screen.getByRole('button', { name: '행사 만들기' }))
  expect((await screen.findByRole('alert')).textContent).toContain('목록을 새로고침')
  expect((screen.getByLabelText('행사 이름') as HTMLInputElement).value).toBe('체육대회')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('changing council discards the old list and ignores late responses', async () => {
  let resolve!: (value: unknown) => void
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValueOnce(ok({ events: [] }))
  vi.stubGlobal('fetch', fetchMock)
  const view = render(<Events organizationId="o1" />)
  view.rerender(<Events organizationId="o2" />)
  await screen.findByText('아직 행사가 없어요.')
  await act(async () => resolve(ok({ events: [event] })))
  expect(screen.queryByText('체육대회')).toBeNull()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/organizations/o2/events', expect.anything()))
})
