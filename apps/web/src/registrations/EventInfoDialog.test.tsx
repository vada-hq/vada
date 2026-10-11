// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { EventSummary } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import { event } from '../test-support/workflow-fixtures'
import EventInfoDialog from './EventInfoDialog'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const directory = { viewer: null, departments: [{ id: 'dp', name: '기획부', isLeadership: false, handlesFinance: false },
  { id: 'dl', name: '회장단', isLeadership: true, handlesFinance: false }],
  members: [{ id: 'mp', name: '정민재', title: null, departmentId: 'dp' }, { id: 'mn', name: '강하늘', title: null, departmentId: null }] }
function setup(target: EventSummary = event()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/o/members', () => json(directory))
  const onSaved = vi.fn()
  render(<EventInfoDialog open organizationId="o" event={target} onClose={vi.fn()} onSaved={onSaved} onStale={vi.fn()} />)
  return { api, onSaved }
}
const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement

test('담당 부서와 책임자를 고른다. 책임자는 부서가 있는 구성원만 보이고, 고르면 빈 담당 부서를 채운다', async () => {
  const { api, onSaved } = setup()
  api.on('PATCH', '/api/organizations/o/events/e', call => json({ event: { ...event(), version: 2, ...(call.body as object) } }))
  await vi.waitFor(() => expect(select('책임자(선택)').disabled).toBe(false))
  expect([...select('책임자(선택)').options].map(option => option.text)).toEqual(['없음', '정민재'])
  fireEvent.change(select('책임자(선택)'), { target: { value: 'mp' } })
  expect(select('담당 부서(선택)').value).toBe('dp')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(api.calls.find(call => call.method === 'PATCH')?.body).toEqual({ version: 1, startsAt: null, endsAt: null, place: null,
    ownerDepartmentId: 'dp', ownerMembershipId: 'mp' })
  api.assertNoUnexpectedRequests()
})

test('담당 부서를 먼저 골랐으면 책임자를 골라도 그대로 둔다', async () => {
  setup()
  await vi.waitFor(() => expect(select('책임자(선택)').disabled).toBe(false))
  fireEvent.change(select('담당 부서(선택)'), { target: { value: 'dl' } })
  fireEvent.change(select('책임자(선택)'), { target: { value: 'mp' } })
  expect(select('담당 부서(선택)').value).toBe('dl')
})

test('미배정이 된 지금 책임자는 고른 채로 남는다', async () => {
  setup({ ...event(), ownerDepartment: null, owner: { membershipId: 'mn', name: '강하늘' } })
  await vi.waitFor(() => expect(select('책임자(선택)').disabled).toBe(false))
  expect(select('책임자(선택)').value).toBe('mn')
  expect([...select('책임자(선택)').options].map(option => option.text)).toContain('강하늘 (미배정)')
})

test('고를 수 없는 책임자면 서버 이유를 보이고 구성원 목록을 새로 받는다', async () => {
  const { api } = setup()
  api.on('PATCH', '/api/organizations/o/events/e', () => json({ error: 'EVENT_OWNER_INVALID' }, 409))
  await vi.waitFor(() => expect(select('책임자(선택)').disabled).toBe(false))
  fireEvent.change(select('책임자(선택)'), { target: { value: 'mp' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('부서가 있는 구성원만 책임자로 정할 수 있어요. 목록을 새로 불러와 다시 골라 주세요.')).toBeTruthy()
  await vi.waitFor(() => expect(api.calls.filter(call => call.path === '/api/organizations/o/members')).toHaveLength(2))
})

test('구성원 목록을 못 받으면 담당은 고를 수 없다고 알리고 일시·장소는 저장한다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/o/members', () => json({ error: 'FORBIDDEN' }, 403))
  render(<EventInfoDialog open organizationId="o" event={event()} onClose={vi.fn()} onSaved={vi.fn()} onStale={vi.fn()} />)
  expect(await screen.findByText('구성원 목록을 불러오지 못해 담당은 고를 수 없어요.')).toBeTruthy()
  expect(screen.queryByLabelText('책임자(선택)')).toBeNull()
})
