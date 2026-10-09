// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MembershipSummary } from '@vada/contracts'
import Workspace from './Workspace'
import { candidate, item } from '../purchases/purchase-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const membership: MembershipSummary = { id: 'm1', organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }, department: { id: 'd1', name: '기획부', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } }
const financeMembership: MembershipSummary = { ...membership, department: { id: 'd1', name: '기획부', handlesFinance: true, isLeadership: false }, permissions: { manageOrganization: false, approvePurchases: true } }
const leaderMembership: MembershipSummary = { ...membership, department: { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true }, title: '회장', permissions: { manageOrganization: true, approvePurchases: true } }
const membersBody = { viewer: membership, departments: [{ id: 'd1', name: '기획부', isLeadership: false, handlesFinance: false }],
  members: [{ id: 'm1', name: '테스터', title: null, departmentId: 'd1' }] }
const event = { id: 'e1', organizationId: 'o1', name: '체육대회', createdBy: 'u1', createdAt: '2026-09-29T00:00:00Z' }
const props = { memberships: [membership], user: { name: '테스터', email: 'test@example.test' }, logoutBusy: false, onLogout: vi.fn() }
function setup(members: unknown = membersBody, review: unknown = { pending: [], approved: [], truncated: false }) {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith('/events')
    ? { events: [event, { ...event, id: 'e2', name: '축제' }] }
    : url.endsWith('/members') ? members
    : url.endsWith('/messages') ? { messages: [], nextCursor: null }
    : url.endsWith('/purchase-candidates') ? { candidates: [], truncated: false }
    : url.endsWith('/purchase-review') ? review
    : url.includes('/delivery-carriers') ? { carriers: [], nextCursor: null }
    : { items: [], truncated: false } }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

test('sidebar selects events; tabs retain chat draft without mixing events', async () => {
  const fetcher = setup()
  render(<Workspace {...props} />)
  expect(screen.getByText('기획부')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '작성 중인 대화' } })
  const history = screen.getByRole('region', { name: '대화 기록' })
  history.scrollTop = 120
  expect(fetcher.mock.calls.some(([url]) => String(url).includes('purchase-items'))).toBe(false)
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  await screen.findByText('아직 올라온 쿠팡 링크가 없어요')
  fireEvent.click(screen.getByRole('tab', { name: '대화' }))
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('작성 중인 대화')
  expect(screen.getByRole('region', { name: '대화 기록' }).scrollTop).toBe(120)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: '축제' }))
  await screen.findByText('아직 대화가 없어요.')
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('')
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/organizations/o1/events/e2/purchase-items', expect.anything()))
})

test('구매 탭은 후보로 열리고, 후보에서 담으면 내 품목에서 새 품목을 골라 둔 채 보여 준다', async () => {
  const created = item({ id: 'n1', productName: '테이블' })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, status: init?.method === 'POST' ? 201 : 200, json: async () =>
    url.endsWith('/events') ? { events: [event, { ...event, id: 'e2', name: '축제' }] }
      : url.endsWith('/messages') ? { messages: [], nextCursor: null }
        : url.endsWith('/purchase-candidates') ? { candidates: [candidate({ product: { ...candidate().product!, name: '테이블' } })], truncated: false }
          : url.endsWith('/drafts') ? { items: [created] } : { items: [], truncated: false } })))
  render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '남겨 둔 대화' } })
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: '테이블 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '선택한 1개 담기' }))
  expect(await screen.findByText('1개를 담았어요. 확인하고 제출해 주세요.')).toBeTruthy()
  expect((screen.getByRole('checkbox', { name: '테이블 고르기' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('tab', { name: '대화' }))
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('남겨 둔 대화')
})

test('후보의 공유 표시를 누르면 대화 탭의 그 메시지를 강조하고, 대화의 링크를 누르면 상품 패널을 연다', async () => {
  const url = 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'
  const message = { id: 'm1', chatRoomId: 'r1', author: { id: 'u1', name: '기획 테스터' }, content: `이거 ${url}`, createdAt: '2026-10-09T05:12:00Z' }
  vi.stubGlobal('fetch', vi.fn(async (path: string) => ({ ok: true, status: 200, json: async () =>
    path.endsWith('/events') ? { events: [event] } : path.endsWith('/messages') ? { messages: [message], nextCursor: null }
      : path.endsWith('/purchase-candidates') ? { candidates: [candidate()], truncated: false } : { items: [], truncated: false } })))
  Element.prototype.scrollIntoView = vi.fn()
  try {
    render(<Workspace {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
    fireEvent.click(screen.getByRole('tab', { name: '구매' }))
    fireEvent.click(await screen.findByRole('button', { name: '기획 테스터 · 10월 9일 오후 2:12에 공유' }))
    expect(screen.getByRole('tab', { name: '대화' }).getAttribute('aria-selected')).toBe('true')
    const link = screen.getByRole('button', { name: url })
    await waitFor(() => expect(link.closest('li')!.className).toContain('bg-yellow-50'))
    fireEvent.click(link)
    expect(await screen.findByRole('dialog', { name: '모닝글로리 유성매직 12색' })).toBeTruthy()
  } finally {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  }
})

test('대화의 링크를 열면 후보를 바로 새로 불러오고, 후보에 없는 링크면 쿠팡에서 확인하라고 알린다', async () => {
  const url = 'https://www.coupang.com/vp/products/9?itemId=8&vendorItemId=7'
  const message = { id: 'm1', chatRoomId: 'r1', author: { id: 'u1', name: '기획 테스터' }, content: `옛 링크 ${url}`, createdAt: '2026-10-09T05:12:00Z' }
  const fetcher = vi.fn(async (path: string) => ({ ok: true, status: 200, json: async () =>
    path.endsWith('/events') ? { events: [event] } : path.endsWith('/messages') ? { messages: [message], nextCursor: null }
      : path.endsWith('/purchase-candidates') ? { candidates: [candidate()], truncated: false } : { items: [], truncated: false } }))
  vi.stubGlobal('fetch', fetcher)
  const candidateCalls = () => fetcher.mock.calls.filter(([path]) => String(path).endsWith('/purchase-candidates')).length
  render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  await screen.findByText('모닝글로리 유성매직 12색')
  fireEvent.click(screen.getByRole('tab', { name: '대화' }))
  const before = candidateCalls()
  fireEvent.click(screen.getByRole('button', { name: url }))
  await waitFor(() => expect(candidateCalls()).toBe(before + 1), { timeout: 1000 })
  expect(await screen.findByText('상품 정보를 가져오지 못했어요. 쿠팡에서 확인해 주세요.')).toBeTruthy()
})

test('workspace tabs support keyboard navigation and logout delegates to authentication', async () => {
  setup()
  render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  fireEvent.keyDown(screen.getByRole('tab', { name: '대화' }), { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: '구매' }).getAttribute('aria-selected')).toBe('true')
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
  expect(screen.queryByText('구매 승인')).toBeNull()
  expect(screen.getByRole('button', { name: '구성원 초대' })).toBeTruthy()
})

test('a newly joined council is opened first', async () => {
  const fetcher = setup()
  render(<Workspace {...props} memberships={[membership, { ...membership, id: 'm2', organization: { id: 'o2', name: '다른 학생회', inviteCode: 'EFGH6789' } }]} initialOrganizationId="o2" />)
  expect((screen.getByLabelText('학생회 선택') as HTMLSelectElement).value).toBe('m2')
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/organizations/o2/events', expect.anything()))
})

test('the header title is the chosen event, or 행사 before one is chosen', async () => {
  setup()
  render(<Workspace {...props} />)
  expect(screen.getByRole('heading', { level: 1, name: '행사' })).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  expect(screen.getByRole('heading', { level: 1, name: '체육대회' })).toBeTruthy()
})

test('on a narrow screen the menu button opens the sidebar, and choosing an event closes it', async () => {
  setup()
  render(<Workspace {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const menu = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  fireEvent.click(await within(menu).findByRole('button', { name: '체육대회' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '학생회 작업 공간' })).toBeNull())
  expect(screen.getByRole('heading', { level: 1, name: '체육대회' })).toBeTruthy()
})

test('the invite dialog shows the council link and code', async () => {
  setup()
  render(<Workspace {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '구성원 초대' }))
  const dialog = await screen.findByRole('dialog', { name: '구성원 초대' })
  expect((within(dialog).getByLabelText('초대 코드') as HTMLInputElement).value).toBe('ABCD2345')
  expect((within(dialog).getByLabelText('초대 링크') as HTMLInputElement).value).toBe(`${window.location.origin}/join/ABCD2345`)
})

test('a new event is created in a dialog that closes on success and on Escape', async () => {
  const created = { ...event, id: 'e3', name: '가을 축제' }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, status: 200, json: async () =>
    init?.method === 'POST' ? { event: created }
      : url.endsWith('/events') ? { events: [event] }
        : url.endsWith('/messages') ? { messages: [], nextCursor: null } : { requests: [], nextCursor: null } })))
  render(<Workspace {...props} />)
  // 목록을 다 불러온 뒤에야 만들기 버튼이 활성화되므로 목록을 먼저 기다린다.
  await screen.findByRole('button', { name: '체육대회' })
  fireEvent.click(screen.getByRole('button', { name: '새 행사' }))
  const dialog = await screen.findByRole('dialog', { name: '새 행사' })
  fireEvent.change(within(dialog).getByLabelText('행사 이름'), { target: { value: '가을 축제' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '행사 만들기' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '새 행사' })).toBeNull())
  expect(await screen.findByRole('button', { name: '가을 축제' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '새 행사' }))
  fireEvent.keyDown(await screen.findByRole('dialog', { name: '새 행사' }), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '새 행사' })).toBeNull())
})

// jsdom의 click은 포커스를 옮기지 않으므로, 실제 클릭·키보드처럼 버튼에 먼저 포커스를 준다.
test('closing the invite dialog returns focus to the button that opened it', async () => {
  setup()
  render(<Workspace {...props} />)
  const opener = screen.getByRole('button', { name: '구성원 초대' })
  opener.focus()
  fireEvent.click(opener)
  fireEvent.keyDown(await screen.findByRole('dialog', { name: '구성원 초대' }), { key: 'Escape' })
  await waitFor(() => expect(document.activeElement).toBe(opener))
})

test('closing the mobile menu returns focus to the menu button', async () => {
  setup()
  render(<Workspace {...props} />)
  const opener = screen.getByRole('button', { name: '메뉴 열기' })
  opener.focus()
  fireEvent.click(opener)
  fireEvent.keyDown(await screen.findByRole('dialog', { name: '학생회 작업 공간' }), { key: 'Escape' })
  await waitFor(() => expect(document.activeElement).toBe(opener))
})

test('새 행사 inside the mobile menu opens the dialog and leaves the page usable after closing', async () => {
  setup()
  render(<Workspace {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const menu = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  await within(menu).findByRole('button', { name: '체육대회' })
  fireEvent.click(within(menu).getByRole('button', { name: '새 행사' }))
  fireEvent.keyDown(await screen.findByRole('dialog', { name: '새 행사' }), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  // 겹친 대화상자가 닫힌 뒤 화면이 다시 눌리고 보조 기술에도 보여야 한다.
  expect(document.body.style.pointerEvents).toBe('')
  expect(screen.getByRole('button', { name: '메뉴 열기' })).toBeTruthy()
})

const membersButton = () => within(screen.getByRole('navigation', { name: '학생회 메뉴' })).getByRole('button')

test('구성원 메뉴는 구성원 화면을 열고, 행사를 고르면 행사 화면으로 돌아간다', async () => {
  const fetcher = setup()
  render(<Workspace {...props} />)
  expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/members'))).toBe(false)
  fireEvent.click(membersButton())
  expect(await screen.findByRole('heading', { name: '구성원 1명' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1, name: '구성원' })).toBeTruthy()
  expect(membersButton().getAttribute('aria-current')).toBe('page')
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  expect(screen.getByRole('heading', { level: 1, name: '체육대회' })).toBeTruthy()
})

test('회장단은 미배정 수와 구매 승인 표시를 본다', async () => {
  setup({ viewer: leaderMembership, departments: [{ id: 'lead', name: '회장단', isLeadership: true, handlesFinance: false }],
    members: [{ id: 'm1', name: '테스터', title: '회장', departmentId: 'lead' }, { id: 'm2', name: '새내기', title: null, departmentId: null }] })
  render(<Workspace {...props} memberships={[leaderMembership]} />)
  expect(await within(screen.getByRole('navigation', { name: '학생회 메뉴' })).findByText('미배정 1')).toBeTruthy()
  expect(screen.getByText('구매 승인')).toBeTruthy()
  expect(screen.getByText('회장단 · 회장')).toBeTruthy()
  expect(within(screen.getByRole('navigation', { name: '학생회 메뉴' })).getByRole('button', { name: /구매 검토/ })).toBeTruthy()
})

test('구성원 목록의 본인 정보가 다르면 소속을 다시 불러온다', async () => {
  setup({ ...membersBody, viewer: { ...membership, department: null } })
  const onMembershipsChanged = vi.fn()
  render(<Workspace {...props} onMembershipsChanged={onMembershipsChanged} />)
  fireEvent.click(membersButton())
  await waitFor(() => expect(onMembershipsChanged).toHaveBeenCalledOnce())
})

test('방금 만든 학생회는 구성원 화면부터 연다', async () => {
  setup()
  render(<Workspace {...props} initialOrganizationId="o1" initialView="members" />)
  expect(await screen.findByRole('heading', { name: '구성원 1명' })).toBeTruthy()
})

test('구매 승인 권한이 있으면 구매 검토 메뉴에 대기 수를 보여 주고, 열면 모든 행사의 검토할 품목을 본다', async () => {
  const pending = item({ id: 'p1', productName: '박스테이프', status: 'pending', submissionId: 's1', mine: false,
    requester: { id: 'q', name: '다른 기획' }, departmentName: '홍보부', submittedAt: '2026-10-08T05:00:00Z' })
  setup(membersBody, { pending: [pending], approved: [], truncated: false })
  render(<Workspace {...props} memberships={[financeMembership]} />)
  const nav = screen.getByRole('navigation', { name: '학생회 메뉴' })
  expect(await within(nav).findByText('대기 1')).toBeTruthy()
  fireEvent.click(within(nav).getByRole('button', { name: /구매 검토/ }))
  expect(screen.getByRole('heading', { level: 1, name: '구매 검토' })).toBeTruthy()
  expect(await screen.findByRole('region', { name: '다른 기획의 제출' })).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  expect(screen.getByRole('heading', { level: 1, name: '체육대회' })).toBeTruthy()
})

test('구매 승인 권한이 없으면 구매 검토 메뉴가 없고 불러오지도 않는다', async () => {
  const fetcher = setup()
  render(<Workspace {...props} />)
  await screen.findByRole('button', { name: '체육대회' })
  expect(within(screen.getByRole('navigation', { name: '학생회 메뉴' })).queryByRole('button', { name: /구매 검토/ })).toBeNull()
  expect(fetcher.mock.calls.some(([url]) => String(url).includes('purchase-review'))).toBe(false)
})
