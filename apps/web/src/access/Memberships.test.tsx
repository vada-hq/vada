// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Memberships from './Memberships'

const planner = { id: 'm1', organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }, department: { id: 'd1', name: '기획부', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } }

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
test('shows council and department from the server', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memberships: [planner] }) })
  vi.stubGlobal('fetch', fetchMock)
  render(<Memberships />)
  expect(await screen.findByText('검증 학생회 · 기획부')).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/me/memberships', expect.objectContaining({ credentials: 'same-origin' }))
})
test('empty memberships show the injected content, or a plain message without it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memberships: [] }) }))
  const view = render(<Memberships renderEmpty={() => <p>코드 입력 자리</p>} />)
  expect(await screen.findByText('코드 입력 자리')).toBeTruthy()
  view.unmount()
  render(<Memberships />)
  expect(await screen.findByText('아직 참여한 학생회가 없어요')).toBeTruthy()
})

test('renders organization content only for memberships returned by the server', async () => {
  const renderMemberships = vi.fn(memberships => <p>행사 영역: {memberships[0].organization.id}</p>)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okMemberships()))
  render(<Memberships renderMemberships={renderMemberships} />)
  expect(await screen.findByText('행사 영역: o1')).toBeTruthy()
  expect(renderMemberships).toHaveBeenCalledWith([planner])
})

function okMemberships() {
  return { ok: true, json: async () => ({ memberships: [planner] }) }
}
test('fetch failure is distinct from no membership and can be retried', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ memberships: [] }) }))
  render(<Memberships />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('아직 참여한 학생회가 없어요')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '소속 다시 확인' }))
  expect(await screen.findByText('아직 참여한 학생회가 없어요')).toBeTruthy()
})

test('a member without a department is shown as unassigned', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memberships: [{ ...planner, department: null }] }) }))
  render(<Memberships />)
  expect(await screen.findByText('검증 학생회 · 미배정')).toBeTruthy()
})
