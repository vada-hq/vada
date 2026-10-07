// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Workspace from './Workspace'
import '../purchases/LinkDialog.test-support'
import { draft } from '../purchases/purchase-test-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const membership = { id: 'm1', organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }, department: { id: 'd1', name: '기획부', handlesFinance: false } }
const event = { id: 'e1', organizationId: 'o1', name: '체육대회', createdBy: 'u1', createdAt: '2026-09-29T00:00:00Z' }
const props = { memberships: [membership], user: { name: '테스터', email: 'test@example.test' }, logoutBusy: false, onLogout: vi.fn() }
function setup() {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith('/events')
    ? { events: [event, { ...event, id: 'e2', name: '축제' }] }
    : url.endsWith('/messages') ? { messages: [], nextCursor: null } : { requests: [], nextCursor: null } }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

test('sidebar selects events; tabs retain chat draft and purchase link input without mixing events', async () => {
  const fetcher = setup()
  render(<Workspace {...props} />)
  expect(screen.getByText('기획부')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '작성 중인 대화' } })
  const history = screen.getByRole('region', { name: '대화 기록' })
  history.scrollTop = 120
  expect(fetcher.mock.calls.some(([url]) => url.includes('purchase-requests'))).toBe(false)
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  await screen.findByText('아직 내 요청서가 없어요.')
  fireEvent.click(screen.getByRole('button', { name: '끼룩이 · 초안 만들기' }))
  fireEvent.change(screen.getByLabelText('쿠팡 상품 링크'), { target: { value: 'https://www.coupang.com/vp/products/1' } })
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  fireEvent.click(screen.getByRole('tab', { name: '대화' }))
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('작성 중인 대화')
  expect(screen.getByRole('region', { name: '대화 기록' }).scrollTop).toBe(120)
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  fireEvent.click(screen.getByRole('button', { name: '끼룩이 · 초안 만들기' }))
  expect((screen.getByLabelText('쿠팡 상품 링크') as HTMLTextAreaElement).value).toContain('/products/1')
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: '축제' }))
  await screen.findByText('아직 대화가 없어요.')
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('')
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/organizations/o1/events/e2/purchase-requests', expect.anything()))
})

test('launches from chat, opens generated detail and restores chat; unsaved purchase edits guard event changes', async () => {
  const request = { id: 'r', organizationId: 'o1', eventId: 'e1', requesterId: 'u1', departmentId: 'd1',
    purpose: '행사 준비', neededBy: null, estimatedShippingCost: null, estimatedTotal: null,
    status: 'draft', version: 1, createdAt: event.createdAt, updatedAt: event.createdAt,
    items: [], warnings: [], sources: [], history: [] }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () =>
    url.endsWith('/events') ? { events: [event, { ...event, id: 'e2', name: '축제' }] }
      : url.endsWith('/messages') ? { messages: [], nextCursor: null }
        : url.endsWith('/drafts') ? { request } : { requests: [], nextCursor: null } })))
  render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '남겨 둔 대화' } })
  screen.getByRole('region', { name: '대화 기록' }).scrollTop = 80
  fireEvent.click(screen.getByRole('button', { name: '끼룩이' }))
  await waitFor(() => expect(screen.getByLabelText('쿠팡 상품 링크').hasAttribute('disabled')).toBe(false))
  fireEvent.change(screen.getByLabelText('쿠팡 상품 링크'), { target: { value: 'https://www.coupang.com/vp/products/1' } })
  fireEvent.click(screen.getByRole('button', { name: '초안 만들기' }))
  await screen.findByRole('heading', { name: '구매요청서 · 검토 대기' })
  // 대화 상자는 초안 생성 요청이 끝난 다음 차례에 닫힌다. 제목이 먼저 보일 수 있어 닫힐 때까지 기다린다.
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('tab', { name: '구매요청' }).getAttribute('aria-selected')).toBe('true')
  fireEvent.change(screen.getByLabelText('구매 목적'), { target: { value: '수정 중인 목적' } })
  fireEvent.click(screen.getByRole('button', { name: '대화로 돌아가기' }))
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('남겨 둔 대화')
  expect(screen.getByRole('region', { name: '대화 기록' }).scrollTop).toBe(80)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: '축제' }))
  expect(screen.getByRole('heading', { name: '체육대회' })).toBeTruthy()
  expect(confirm).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  expect((screen.getByLabelText('구매 목적') as HTMLTextAreaElement).value).toBe('수정 중인 목적')
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: '축제' }))
  expect(screen.queryByRole('heading', { name: '구매요청서 · 검토 대기' })).toBeNull()
})

test('finance inbox is available only to finance membership and uses the selected event', async () => {
  const fetcher = setup()
  const view = render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  expect(screen.queryByRole('button', { name: '재정부 제출 요청 보기' })).toBeNull()
  view.rerender(<Workspace {...props} memberships={[{ ...membership, department: { ...membership.department, handlesFinance: true } }]} />)
  fireEvent.click(screen.getByRole('button', { name: '재정부 제출 요청 보기' }))
  await screen.findByText('제출된 요청서가 없어요.')
  expect(screen.queryByRole('heading', { name: '내 구매요청' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '내 요청 보기' }))
  expect(screen.getByRole('heading', { name: '내 구매요청' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '재정부 · 제출 요청 조회' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '재정부 제출 요청 보기' }))
  expect(fetcher).toHaveBeenCalledWith('/api/organizations/o1/events/e1/purchase-requests/finance', expect.anything())
  view.rerender(<Workspace {...props} />)
  expect(screen.queryByText('재정부 · 제출 요청 조회')).toBeNull()
  expect(screen.getByRole('heading', { name: '내 구매요청' })).toBeTruthy()
})

test('switching between own requests and finance review preserves rejection input and guards event exit', async () => {
  const request = { ...draft(), organizationId: 'o1', eventId: 'e1', status: 'submitted' as const }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () =>
    url.endsWith('/events') ? { events: [event, { ...event, id: 'e2', name: '축제' }] }
      : url.endsWith('/messages') ? { messages: [], nextCursor: null }
        : url.endsWith('/finance/r') ? { request }
          : { requests: url.endsWith('/finance') ? [request] : [], nextCursor: null } })))
  render(<Workspace {...props} memberships={[{ ...membership, department: { ...membership.department, handlesFinance: true } }]} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  fireEvent.click(screen.getByRole('button', { name: '재정부 제출 요청 보기' }))
  fireEvent.click(await screen.findByRole('button', { name: /접수용 접수/ }))
  fireEvent.change(await screen.findByLabelText('반려 사유'), { target: { value: '수량을 확인해 주세요' } })
  fireEvent.click(screen.getByRole('button', { name: '내 요청 보기' }))
  expect(screen.queryByRole('region', { name: '재정부 처리' })).toBeNull()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: '축제' }))
  expect(confirm).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: '재정부 제출 요청 보기' }))
  expect((screen.getByLabelText('반려 사유') as HTMLTextAreaElement).value).toBe('수량을 확인해 주세요')
})

test('workspace tabs support keyboard navigation and logout delegates to authentication', async () => {
  setup()
  render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  fireEvent.keyDown(screen.getByRole('tab', { name: '대화' }), { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: '구매요청' }).getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  expect(props.onLogout).toHaveBeenCalled()
})

test('switching membership clears the selected event and uses the new council endpoint', async () => {
  const fetcher = setup()
  render(<Workspace {...props} memberships={[membership, { ...membership, id: 'm2', organization: { id: 'o2', name: '다른 학생회', inviteCode: 'EFGH6789' } }]} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('학생회 선택'), { target: { value: 'm2' } })
  expect(screen.queryByRole('tab', { name: '대화' })).toBeNull()
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/organizations/o2/events', expect.anything()))
})

test('an unassigned member sees 미배정 and no finance badge', () => {
  setup()
  render(<Workspace {...props} memberships={[{ ...membership, department: null }]} />)
  expect(screen.getByText('미배정')).toBeTruthy()
  expect(screen.queryByText('재정 담당')).toBeNull()
})

test('a newly joined council is opened first', async () => {
  const fetcher = setup()
  render(<Workspace {...props} memberships={[membership, { ...membership, id: 'm2', organization: { id: 'o2', name: '다른 학생회', inviteCode: 'EFGH6789' } }]} initialOrganizationId="o2" />)
  expect((screen.getByLabelText('학생회 선택') as HTMLSelectElement).value).toBe('m2')
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/organizations/o2/events', expect.anything()))
})
