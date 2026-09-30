// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Memberships from './Memberships'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
test('shows council and department from the server', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memberships: [{ id: 'm1', organization: { id: 'o1', name: '검증 학생회' }, department: { id: 'd1', name: '기획부', handlesFinance: false } }] }) })
  vi.stubGlobal('fetch', fetchMock)
  render(<Memberships />)
  expect(await screen.findByText('검증 학생회 · 기획부')).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/me/memberships', expect.objectContaining({ credentials: 'same-origin' }))
})
test('empty memberships show unassigned, not a signup form', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memberships: [] }) }))
  render(<Memberships />)
  expect(await screen.findByText('소속 미지정')).toBeTruthy()
})

test('renders organization content only for memberships returned by the server', async () => {
  const renderOrganization = vi.fn(organization => <p>행사 영역: {organization.id}</p>)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okMemberships()))
  render(<Memberships renderOrganization={renderOrganization} />)
  expect(await screen.findByText('행사 영역: o1')).toBeTruthy()
  expect(renderOrganization).toHaveBeenCalledWith({ id: 'o1', name: '검증 학생회' }, false)
})

function okMemberships() {
  return { ok: true, json: async () => ({ memberships: [{ id: 'm1', organization: { id: 'o1', name: '검증 학생회' }, department: { id: 'd1', name: '기획부', handlesFinance: false } }] }) }
}
test('fetch failure is distinct from no membership and can be retried', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ memberships: [] }) }))
  render(<Memberships />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('소속 미지정')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '소속 다시 확인' }))
  expect(await screen.findByText('소속 미지정')).toBeTruthy()
})
