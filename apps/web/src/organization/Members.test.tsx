// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { DepartmentSummary, MemberSummary, MembershipSummary, OrganizationMembersResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import Members from './Members'
import { useOrganizationMembers } from './useOrganizationMembers'

const base = '/api/organizations/o'
const departments: DepartmentSummary[] = [
  { id: 'fin', name: '총무부', isLeadership: false, handlesFinance: true },
  { id: 'lead', name: '회장단', isLeadership: true, handlesFinance: false },
  { id: 'plan', name: '기획부', isLeadership: false, handlesFinance: false },
]
const members: MemberSummary[] = [
  { id: 'm-lead', name: '김바다', title: '회장', departmentId: 'lead' },
  { id: 'm-fin', name: '김민준', title: '총무', departmentId: 'fin' },
  { id: 'm-new', name: '정하늘', title: null, departmentId: null },
  { id: 'm-plan', name: '박민수', title: null, departmentId: 'plan' },
]
const viewer = (manage: boolean): MembershipSummary => ({ id: manage ? 'm-lead' : 'm-plan',
  organization: { id: 'o', name: '테스트 학생회', inviteCode: 'ABCD2345' },
  department: manage ? { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true } : { id: 'plan', name: '기획부', handlesFinance: false, isLeadership: false },
  title: manage ? '회장' : null, permissions: { manageOrganization: manage, approvePurchases: manage, manageEvents: true } })
const response = (manage = true, overrides: Partial<OrganizationMembersResponse> = {}): OrganizationMembersResponse =>
  ({ viewer: viewer(manage), departments, members, ...overrides })
const withMember = (id: string, change: Partial<MemberSummary>) => members.map(member => member.id === id ? { ...member, ...change } : member)

function Harness() {
  const state = useOrganizationMembers('o', true)
  return <Members inviteCode="ABCD2345" state={state} />
}
let api: ReturnType<typeof mockApi>
beforeEach(() => { api = mockApi() })
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})
const groupNames = () => screen.getAllByRole('region').map(region => region.getAttribute('aria-label'))

test('회장단은 미배정·회장단·가나다순 부서 묶음과 편집칸을 본다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  render(<Harness />)
  expect(await screen.findByRole('heading', { name: '구성원 4명' })).toBeTruthy()
  expect(groupNames()).toEqual(['미배정', '회장단', '기획부', '총무부'])
  expect(within(screen.getByRole('region', { name: '미배정' })).getByText('배정이 필요해요')).toBeTruthy()
  const leadership = within(screen.getByRole('region', { name: '회장단' }))
  expect(leadership.getByText('조직 관리')).toBeTruthy()
  expect(leadership.getByText('구매 승인')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: '총무부' })).getByText('구매 승인')).toBeTruthy()
  expect(screen.getByText(/김바다/).textContent).toBe('김바다 · 회장')
  expect((screen.getByLabelText('정하늘 부서') as HTMLSelectElement).value).toBe('')
  expect(screen.getByRole('button', { name: '총무부 편집' })).toBeTruthy()
  expect(screen.getByText('회장단이 한 명뿐이에요. 자리를 비울 때를 대비해 한 명 더 두세요.')).toBeTruthy()
})

test('일반 구성원은 같은 목록을 보되 편집칸이 없다', async () => {
  api.on('GET', `${base}/members`, () => json(response(false)))
  render(<Harness />)
  await screen.findByRole('heading', { name: '구성원 4명' })
  expect(groupNames()).toEqual(['미배정', '회장단', '기획부', '총무부'])
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByText('배정이 필요해요')).toBeNull()
  expect(screen.queryByRole('button', { name: '회장단 편집' })).toBeNull()
  expect(screen.queryByLabelText('새 부서 이름')).toBeNull()
  expect(screen.queryByText(/한 명뿐이에요/)).toBeNull()
})

test('권한이 그대로인 이동은 바로 저장한다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-new/department`, () => json(response(true, { members: withMember('m-new', { departmentId: 'plan' }) })))
  render(<Harness />)
  fireEvent.change(await screen.findByLabelText('정하늘 부서'), { target: { value: 'plan' } })
  await waitFor(() => expect(groupNames()).toEqual(['회장단', '기획부', '총무부']))
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ departmentId: 'plan' }])
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('권한이 바뀌는 이동은 한 번 확인하고, 취소하면 보내지 않는다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-fin/department`, () => json(response(true, { members: withMember('m-fin', { departmentId: 'plan', title: null }) })))
  render(<Harness />)
  fireEvent.change(await screen.findByLabelText('김민준 부서'), { target: { value: 'plan' } })
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('김민준을 기획부로 옮기면 구매 승인을 할 수 없게 돼요. 직책은 지워져요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  expect((screen.getByLabelText('김민준 부서') as HTMLSelectElement).value).toBe('fin')
  fireEvent.change(screen.getByLabelText('김민준 부서'), { target: { value: 'plan' } })
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '옮기기' }))
  await waitFor(() => expect(within(screen.getByRole('region', { name: '기획부' })).getByText('김민준')).toBeTruthy())
})

test('마지막 회장단을 옮기려 하면 안내하고 원래 값을 유지한다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-lead/department`, () => json({ error: 'LAST_LEADER' }, 409))
  render(<Harness />)
  fireEvent.change(await screen.findByLabelText('김바다 부서'), { target: { value: 'plan' } })
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '옮기기' }))
  expect((await screen.findByRole('alert')).textContent).toBe('회장단은 최소 한 명 있어야 해요. 다른 사람을 먼저 회장단으로 옮겨 주세요.')
  expect((screen.getByLabelText('김바다 부서') as HTMLSelectElement).value).toBe('lead')
})

test('그사이 회장단에서 빠졌으면 안내하고 목록을 다시 불러온다', async () => {
  let manage = true
  api.on('GET', `${base}/members`, () => json(response(manage)))
  api.on('POST', `${base}/members/m-new/department`, () => { manage = false; return json({ error: 'FORBIDDEN' }, 403) })
  render(<Harness />)
  fireEvent.change(await screen.findByLabelText('정하늘 부서'), { target: { value: 'plan' } })
  expect((await screen.findByRole('alert')).textContent).toBe('회장단만 바꿀 수 있어요.')
  await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull())
})

test('직책은 대화상자에서 고치고, 비우면 지운다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-plan/title`, call =>
    json(response(true, { members: withMember('m-plan', { title: (call.body as { title: string | null }).title }) })))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '박민수 직책' }))
  fireEvent.change(within(await screen.findByRole('dialog')).getByLabelText('직책'), { target: { value: ' 국장 ' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(/박민수/).textContent).toBe('박민수 · 국장')
  fireEvent.click(screen.getByRole('button', { name: '박민수 직책' }))
  fireEvent.change(within(await screen.findByRole('dialog')).getByLabelText('직책'), { target: { value: '' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.getByText(/박민수/).textContent).toBe('박민수'))
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ title: '국장' }, { title: null }])
})

test('회장단은 부서를 추가·편집하고, 지울 수 없는 부서는 대화상자 안에서 안내한다', async () => {
  const promo = (handlesFinance: boolean) => response(true, { departments: [...departments, { id: 'promo', name: '홍보부', isLeadership: false, handlesFinance }] })
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/departments`, call => (call.body as { name: string }).name === '기획부' ? json({ error: 'DEPARTMENT_NAME_TAKEN' }, 409) : json(promo(false)))
  api.on('PATCH', `${base}/departments/promo`, () => json(promo(true)))
  api.on('POST', `${base}/departments/promo/delete`, () => json({ error: 'DEPARTMENT_IN_USE' }, 409))
  render(<Harness />)
  const input = await screen.findByLabelText('새 부서 이름')
  fireEvent.change(input, { target: { value: '기획부' } })
  fireEvent.click(screen.getByRole('button', { name: '부서 추가' }))
  expect((await screen.findByRole('alert')).textContent).toBe('같은 이름의 부서가 있어요.')
  fireEvent.change(input, { target: { value: ' 홍보부 ' } })
  fireEvent.click(screen.getByRole('button', { name: '부서 추가' }))
  expect(await screen.findByRole('region', { name: '홍보부' })).toBeTruthy()
  expect((screen.getByLabelText('새 부서 이름') as HTMLInputElement).value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '홍보부 편집' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByLabelText('구매 승인'))
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(within(screen.getByRole('region', { name: '홍보부' })).getByText('구매 승인')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: '홍보부 편집' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '부서 삭제' }))
  expect(await within(screen.getByRole('dialog')).findByText('구매요청 기록이 있어 지울 수 없어요. 이름을 바꿔 쓰세요.')).toBeTruthy()
  expect(api.calls.filter(call => call.method !== 'GET').map(call => [call.method, call.path, call.body])).toEqual([
    ['POST', `${base}/departments`, { name: '기획부' }], ['POST', `${base}/departments`, { name: '홍보부' }],
    ['PATCH', `${base}/departments/promo`, { name: '홍보부', handlesFinance: true }], ['POST', `${base}/departments/promo/delete`, {}],
  ])
})

test('회장단 편집에는 구매 승인과 삭제가 없다', async () => {
  api.on('GET', `${base}/members`, () => json(response(true, { members: [members[0]!, { id: 'm-new', name: '정하늘', title: null, departmentId: 'lead' }] })))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '회장단 편집' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('회장단은 지울 수 없고 이름만 바꿀 수 있어요.')).toBeTruthy()
  expect(within(dialog).queryByLabelText('구매 승인')).toBeNull()
  expect(within(dialog).queryByRole('button', { name: '부서 삭제' })).toBeNull()
})

test('혼자이면 초대 링크를 목록 위에 보여 준다', async () => {
  api.on('GET', `${base}/members`, () => json(response(true, { members: [members[0]!] })))
  render(<Harness />)
  expect(await screen.findByText('아직 혼자예요')).toBeTruthy()
  expect(screen.getByLabelText('초대 코드')).toBeTruthy()
  // 초대 블록도 이름 있는 영역이다. 목록 묶음보다 앞에 있어야 한다.
  expect(groupNames()).toEqual(['학생회 초대', '회장단', '기획부', '총무부'])
})

test('목록을 못 불러오면 다시 시도할 수 있다', async () => {
  let fail = true
  api.on('GET', `${base}/members`, () => fail ? json({ error: 'UNAVAILABLE' }, 503) : json(response()))
  render(<Harness />)
  expect((await screen.findByRole('alert')).textContent).toBe('구성원을 불러오지 못했어요.')
  fail = false
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('heading', { name: '구성원 4명' })).toBeTruthy()
})

test('개발 모드(StrictMode)에서도 변경 뒤 목록이 바뀌고 칸이 다시 켜진다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-plan/title`, () => json(response(true, { members: withMember('m-plan', { title: '국장' }) })))
  render(<StrictMode><Harness /></StrictMode>)
  fireEvent.click(await screen.findByRole('button', { name: '박민수 직책' }))
  fireEvent.change(within(await screen.findByRole('dialog')).getByLabelText('직책'), { target: { value: '국장' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.getByText(/박민수/).textContent).toBe('박민수 · 국장'))
  expect((screen.getByLabelText('정하늘 부서') as HTMLSelectElement).disabled).toBe(false)
})
