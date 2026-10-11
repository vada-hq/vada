// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MembershipSummary, OrganizationMembersResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import TaskFormDialog from './TaskFormDialog'
import { taskDetail } from './task-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const viewer: MembershipSummary = { id: 'm1', organization: { id: 'o1', name: '학생회', inviteCode: 'ABCD2345' }, department: { id: 'd1', name: '기획부',
  handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false, manageEvents: true } }
const directory: OrganizationMembersResponse = { viewer, departments: [{ id: 'd1', name: '기획부', isLeadership: false, handlesFinance: false },
  { id: 'd2', name: '홍보부', isLeadership: false, handlesFinance: false }],
  members: [{ id: 'm1', name: '테스터', title: null, departmentId: 'd1' }, { id: 'm2', name: '윤태민', title: '홍보부장', departmentId: 'd2' },
    { id: 'm3', name: '강하늘', title: null, departmentId: null }] }
const path = '/api/organizations/o1/events/e1/tasks'

test('새 업무: 제목이 있어야 켜지고, 담당자를 고르면 비어 있던 담당 부서를 그 사람 부서로 채운다. 미배정은 고를 수 없다', async () => {
  const api = mockApi()
  const bodies: unknown[] = []
  api.on('POST', path, call => { bodies.push(call.body); return json({ task: taskDetail() }, 201) })
  const onSaved = vi.fn()
  render(<TaskFormDialog open organizationId="o1" eventId="e1" task={null} directory={directory} directoryError={false} onClose={() => {}} onSaved={onSaved} />)
  const dialog = screen.getByRole('dialog', { name: '업무 추가' })
  const save = within(dialog).getByRole('button', { name: '추가' })
  expect(save.hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(dialog).getByLabelText('제목'), { target: { value: '  현수막 디자인 ' } })
  expect(within(dialog).queryByRole('option', { name: '강하늘' })).toBeNull()
  fireEvent.change(within(dialog).getByLabelText('담당자'), { target: { value: 'm2' } })
  expect((within(dialog).getByLabelText('담당 부서') as HTMLSelectElement).value).toBe('d2')
  fireEvent.change(within(dialog).getByLabelText('마감일'), { target: { value: '2026-10-20' } })
  fireEvent.click(save)
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(taskDetail()))
  expect(bodies).toEqual([{ title: '  현수막 디자인 ', description: null, departmentId: 'd2', assigneeMembershipId: 'm2', dueOn: '2026-10-20' }])
  api.assertNoUnexpectedRequests()
})

test('담당 부서를 먼저 고르면 담당자를 골라도 바꾸지 않는다', () => {
  mockApi()
  render(<TaskFormDialog open organizationId="o1" eventId="e1" task={null} directory={directory} directoryError={false} onClose={() => {}} onSaved={() => {}} />)
  const dialog = screen.getByRole('dialog', { name: '업무 추가' })
  fireEvent.change(within(dialog).getByLabelText('담당 부서'), { target: { value: 'd1' } })
  fireEvent.change(within(dialog).getByLabelText('담당자'), { target: { value: 'm2' } })
  expect((within(dialog).getByLabelText('담당 부서') as HTMLSelectElement).value).toBe('d1')
})

test('수정: 지금 값을 채우고 버전과 함께 보낸다. 미배정이 된 지금 담당자도 고른 채로 둔다. 실패하면 문구를 보인다', async () => {
  const api = mockApi()
  api.on('PATCH', `${path}/t1`, () => json({ error: 'VERSION_CONFLICT' }, 409))
  const task = taskDetail({ assignee: { membershipId: 'm3', name: '강하늘' }, version: 4 })
  render(<TaskFormDialog open organizationId="o1" eventId="e1" task={task} directory={directory} directoryError={false} onClose={() => {}} onSaved={() => {}} />)
  const dialog = screen.getByRole('dialog', { name: '업무 수정' })
  expect((within(dialog).getByLabelText('제목') as HTMLInputElement).value).toBe('현수막 디자인')
  expect((within(dialog).getByLabelText('담당자') as HTMLSelectElement).value).toBe('m3')
  expect(within(dialog).getByRole('option', { name: '강하늘 (미배정)' })).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  expect(await within(dialog).findByText('다른 곳에서 먼저 바뀌었어요. 새로 불러와 주세요.')).toBeTruthy()
  expect(api.calls.at(-1)?.body).toMatchObject({ version: 4, assigneeMembershipId: 'm3' })
})

test('구성원 목록을 못 받으면 부서·담당자 고르기 대신 안내를 보인다', () => {
  mockApi()
  render(<TaskFormDialog open organizationId="o1" eventId="e1" task={null} directory={null} directoryError onClose={() => {}} onSaved={() => {}} />)
  expect(screen.getByText('구성원 목록을 불러오지 못해 담당 부서와 담당자는 고를 수 없어요.')).toBeTruthy()
})

test('구성원 목록을 불러오는 동안에는 지금 담당자를 미배정으로 표시하지 않는다', () => {
  mockApi()
  render(<TaskFormDialog open organizationId="o1" eventId="e1" task={taskDetail()} directory={null} directoryError={false} onClose={() => {}} onSaved={() => {}} />)
  const dialog = screen.getByRole('dialog', { name: '업무 수정' })
  expect(within(dialog).queryByRole('option', { name: '윤태민 (미배정)' })).toBeNull()
  expect((within(dialog).getByLabelText('담당자') as HTMLSelectElement).disabled).toBe(true)
})
