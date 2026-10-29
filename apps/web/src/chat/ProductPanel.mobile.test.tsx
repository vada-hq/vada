// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { windowHistoryIdle } from '@/lib/use-window-history'
import { resetAddress } from '@/test-support/address-reset'
import { message, messagePage, room, roomDetail, roomList } from '@/test-support/chat-fixtures'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import {
  eventDetail,
  eventSummary,
  EVENT_ID,
  MEMBER,
  uuidTeam,
} from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { navigationWidth } from '@/test-support/navigation-width'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import { BottomNavigationVisibility } from '@/components/BottomNavigationVisibility'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import MobileNavigation from '@/workspace/MobileNavigation'
import { ProductPanelFrame } from './ProductPanel'
import ProductDetails from './ProductDetails'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const BASE = `/api/organizations/${COUNCIL_ID}`
const ROOM = '00000000-0000-4000-8000-0000000000a1'
const MESSAGE = '00000000-0000-4000-8000-0000000000b1'
const LINK = 'https://www.coupang.com/vp/products/7334523?itemId=18698271'
const tabs = () => screen.queryByRole('navigation', { name: '휴대폰 메뉴' })

test.each([
  ['unsupported', '쿠팡 상품 주소만 불러올 수 있어요.'],
  ['not_found', '쿠팡에서 찾을 수 없는 상품이에요.'],
  ['unavailable', '지금은 불러올 수 없어요.'],
] as const)('휴대폰 상품 패널의 %s는 빈 상태 아래 까닭과 쿠팡 링크를 보인다', (reason, text) => {
  navigationWidth(390)
  render(
    <ProductPanelFrame focusKey={LINK} onClose={() => {}}>
      <ProductDetails state={{ kind: 'none', reason }} url={LINK} />
    </ProductPanelFrame>,
  )
  const panel = within(screen.getByRole('complementary', { name: '상품 정보' }))
  expect(panel.getByText('상품 정보 없음')).toBeTruthy()
  expect(panel.getByText(text)).toBeTruthy()
  expect(panel.getByRole('link', { name: '쿠팡에서 열기' })).toBeTruthy()
  expect(panel.queryByText(/직접 적어 주세요/)).toBeNull()
})

function openEventMessages() {
  navigationWidth(390)
  window.history.replaceState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}`)
  const api = mockApi()
  const eventRoom = room(ROOM, { eventId: EVENT_ID, eventName: '신입생 환영회' })
  api.on('GET', BASE, () =>
    json(councilView(COUNCIL_ID, { memberId: MEMBER.m1, permissions: MEMBER_PERMISSIONS })),
  )
  api.on('GET', `${BASE}/members`, () => json(uuidTeam()))
  api.on('GET', `${BASE}/rooms`, () => json(roomList({ rooms: [eventRoom] })))
  api.on('GET', `${BASE}/events/open`, () => json({ events: [eventSummary()], more: false }))
  api.on('GET', `${BASE}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${BASE}/events/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', `${BASE}/events/${EVENT_ID}/rooms`, () =>
    json({ rooms: [eventRoom], archived: false }),
  )
  api.on('GET', `${BASE}/rooms/${ROOM}`, () => json(roomDetail(eventRoom)))
  api.on('GET', `${BASE}/rooms/${ROOM}/messages`, () => json(messagePage([message(MESSAGE, LINK)])))
  api.on('POST', `${BASE}/rooms/${ROOM}/read`, () => json({}))
  api.on('GET', `${BASE}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  api.on('POST', `${BASE}/product-info`, () =>
    json({
      product: {
        name: '행사용 네임펜',
        items: [{ itemId: '18698271', name: '네임펜 세트', price: 9900, listPrice: null }],
        selectedItemId: '18698271',
        shipping: null,
        deliveryEta: null,
        rocket: false,
      },
      reason: null,
    }),
  )
  render(<WorkspaceAt startPage="events" />)
  return api
}

test('휴대폰 행사 메시지에서 상품 패널을 열면 아래 탭과 여백을 숨기고 닫으면 복원한다', async () => {
  const api = openEventMessages()
  const link = await screen.findByRole('link', { name: LINK })
  expect(tabs()).toBeTruthy()
  link.focus()
  fireEvent.click(link)
  const panel = await screen.findByRole('complementary', { name: '상품 정보' })
  expect(tabs()).toBeNull()
  expect(screen.getByRole('main').className).not.toContain('bottom-navigation-space')
  await within(panel).findByRole('button', { name: '구매 요청 만들기' })
  fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))
  await screen.findByRole('navigation', { name: '휴대폰 메뉴' })
  expect(screen.getByRole('main').className).toContain('bottom-navigation-space')
  expect(document.activeElement).toBe(link)
  api.assertNoUnexpectedRequests()
})

// 현재 구매 요청은 작성 페이지로 이동하므로 겹친 창의 신호 해제는 공통 Dialog로 검증한다.
function ProductWindows() {
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState(false)
  return (
    <BottomNavigationVisibility>
      <MobileNavigation
        active={{ kind: 'menu', menu: 'home' }}
        unread={0}
        taskCount={null}
        onPage={() => {}}
        onMenu={() => {}}
      />
      <Button onClick={() => setOpen(true)}>상품 정보 열기</Button>
      {open && (
        <ProductPanelFrame focusKey={LINK} onClose={() => setOpen(false)}>
          <Button onClick={() => setRequest(true)}>구매 요청 만들기</Button>
          <Dialog open={request} onOpenChange={setRequest}>
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>구매 요청 내기</DialogTitle>
            </DialogContent>
          </Dialog>
        </ProductPanelFrame>
      )}
    </BottomNavigationVisibility>
  )
}

test.each(['닫기', '뒤로'])(
  '휴대폰 상품 패널 위 구매 요청 창을 %s로 닫아도 패널이 닫힐 때까지 아래 탭을 숨긴다',
  async close => {
    navigationWidth(390)
    render(<ProductWindows />)
    expect(tabs()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '상품 정보 열기' }))
    const panel = await screen.findByRole('complementary', { name: '상품 정보' })
    expect(tabs()).toBeNull()
    fireEvent.click(await within(panel).findByRole('button', { name: '구매 요청 만들기' }))
    const request = await screen.findByRole('dialog', { name: '구매 요청 내기' })
    expect(tabs()).toBeNull()
    if (close === '뒤로') {
      await windowHistoryIdle()
      act(() => window.history.back())
    } else {
      fireEvent.click(within(request).getByRole('button', { name: '닫기' }))
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('complementary', { name: '상품 정보' })).toBe(panel)
    expect(tabs()).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))
    await screen.findByRole('navigation', { name: '휴대폰 메뉴' })
  },
)
