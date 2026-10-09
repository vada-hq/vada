// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import Workspace from './Workspace'
import { json, mockApi } from '../test-support/mock-api'
import { candidatesPath, event, eventsPath, membership, messagesPath, purchaseItemsPath, reviewPath, user } from '../test-support/workflow-fixtures'
import { candidate, item } from '../purchases/purchase-fixtures'

let api: ReturnType<typeof mockApi>
const workspace = (finance = false) => <Workspace memberships={[membership(finance)]} user={user(finance)} logoutBusy={false} onLogout={() => {}} />
beforeEach(() => {
  api = mockApi()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  api.on('GET', eventsPath, () => json({ events: [event(), event('e2')] }))
  for (const id of ['e', 'e2']) {
    api.on('GET', messagesPath(id), () => json({ messages: [], nextCursor: null }))
    api.on('GET', purchaseItemsPath(id), () => json({ items: [], truncated: false }))
    api.on('GET', candidatesPath(id), () => json({ candidates: [], truncated: false }))
  }
})
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})

test.each(['approved', 'rejected'] as const)('후보 담기 → 제출 → 구매 검토 %s → 요청자가 결과를 본다', async decision => {
  // 단계마다 계약 응답을 정해 둔다. 서버의 권한·업무 규칙을 흉내 내지 않는다.
  const draft = item({ id: 'i1', productName: '테이블' })
  const pending = item({ ...draft, status: 'pending', version: 2, submissionId: 's1', submittedAt: '2026-10-08T06:00:00Z', departmentName: '기획부' })
  const decided = item({ ...pending, status: decision, version: 3, decidedAt: '2026-10-08T07:00:00Z', decidedBy: { id: 'f', name: '재정 테스터' },
    decisionReason: decision === 'rejected' ? '수량 재확인' : null })
  api.on('GET', candidatesPath(), () => json({ candidates: [candidate({ product: { ...candidate().product!, name: '테이블' } })], truncated: false }))
  api.on('POST', `${purchaseItemsPath()}/drafts`, () => json({ items: [draft] }, 201))
  api.on('POST', `${purchaseItemsPath()}/submit`, () => json({ items: [pending] }))
  const planning = render(workspace())
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: '테이블 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 담기' }))
  expect(await screen.findByText('1개를 담았어요. 확인하고 제출해 주세요.')).toBeTruthy()
  expect(api.calls.find(call => call.path === `${purchaseItemsPath()}/drafts`)?.body).toEqual({ candidateIds: ['c1'], idempotencyKey: expect.any(String) })
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 제출' }))
  expect(await within(await screen.findByRole('region', { name: '진행 중' })).findByText('테이블')).toBeTruthy()
  expect(api.calls.find(call => call.path === `${purchaseItemsPath()}/submit`)?.body).toEqual({ items: [{ id: 'i1', version: 1 }] })
  planning.unmount()

  api.on('GET', reviewPath, () => json({ pending: [pending], approved: [], truncated: false }))
  api.on('GET', '/api/organizations/o/delivery-carriers', () => json({ carriers: [], nextCursor: null }))
  api.on('POST', `${reviewPath}/decisions`, () => {
    api.on('GET', reviewPath, () => json({ pending: [], approved: decision === 'approved' ? [decided] : [], truncated: false }))
    return json({ items: [decided] })
  })
  const finance = render(workspace(true))
  fireEvent.click(within(screen.getByRole('navigation', { name: '학생회 메뉴' })).getByRole('button', { name: /구매 검토/ }))
  const group = await screen.findByRole('region', { name: '기획 테스터의 제출' })
  if (decision === 'approved') fireEvent.click(within(group).getByRole('button', { name: '승인' }))
  else {
    fireEvent.click(within(group).getByRole('button', { name: '반려' }))
    fireEvent.change(within(group).getByLabelText('반려 사유'), { target: { value: '수량 재확인' } })
    fireEvent.click(within(group).getByRole('button', { name: '반려하기' }))
  }
  expect(await screen.findByText('검토할 품목이 없어요')).toBeTruthy()
  expect(api.calls.find(call => call.path === `${reviewPath}/decisions`)?.body).toEqual({ decisions: [decision === 'approved'
    ? { id: 'i1', version: 2, decision } : { id: 'i1', version: 2, decision, reason: '수량 재확인' }] })
  finance.unmount()

  api.on('GET', purchaseItemsPath(), () => json({ items: [decided], truncated: false }))
  render(workspace())
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  fireEvent.click(await screen.findByRole('tab', { name: '구매' }))
  fireEvent.click(screen.getByRole('button', { name: '내 품목' }))
  const section = await screen.findByRole('region', { name: decision === 'approved' ? '진행 중' : '끝남' })
  expect(within(section).getByText(decision === 'approved' ? '승인' : '반려 사유: 수량 재확인')).toBeTruthy()
})
