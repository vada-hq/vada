// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ChatMessage } from '@vada/contracts'
import { message } from '@/test-support/chat-fixtures'
import MessageItem from './MessageItem'

afterEach(cleanup)

const KKIRUK = message(
  'k1',
  '가을 축제 일시가 바뀌었어요 · 11월 5일 (목) 14:00 → 11월 6일 (금) 14:00\n가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관',
  { senderId: null, senderName: null },
)
const LINKED = message('a1', '이거 사 주세요 https://example.com/a')
const draw = (item: ChatMessage = KKIRUK, mine = false) =>
  render(
    <ul>
      <MessageItem
        councilId="c1"
        message={item}
        continued={false}
        mine={mine}
        canRequest
        onRequest={() => {}}
        canWriteExpense
        onWriteExpense={() => {}}
      />
    </ul>,
  )

// 025 조각 4: 보낸 사람 없는 끼룩이 글은 와이어프레임의 시스템 글처럼 가운데 한 덩어리이고, 사람 이름·말풍선·메뉴가 없다.
test('보낸 사람 없는 글은 끼룩이 글로 그리고 이름과 메시지 동작이 없다', () => {
  draw()
  const item = screen.getByRole('listitem')
  expect(item.textContent).toContain('가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관')
  expect(screen.queryByText('시스템')).toBeNull()
  expect(screen.queryByRole('button', { name: '메시지 동작' })).toBeNull()
  // 끼룩이 그림은 꾸밈이라 글만 읽힌다.
  expect(item.querySelector('img')?.getAttribute('alt')).toBe('')
  expect(item.className).toContain('justify-center')
  // 두 줄은 줄바꿈 그대로다.
  expect(screen.getByText(/일시가 바뀌었어요/).className).toContain('whitespace-pre-wrap')
})

test('사람이 보낸 글은 그대로 이름과 메시지 동작이 있다', () => {
  draw(message('m1', '현수막 2개 사 주세요'))
  expect(screen.getByText('이재정')).toBeTruthy()
  expect(screen.getByRole('button', { name: '메시지 동작' })).toBeTruthy()
  expect(screen.getByRole('listitem').querySelector('img')).toBeNull()
})

// 와이어프레임 메시지 화면: 내 말풍선은 오른쪽 파란색에 흰 글자, 남의 말풍선은 흰 바탕에 테두리.
test('내 메시지는 파란 말풍선이고 안의 링크는 같은 흰 글자에 밑줄이다(DEC-90)', () => {
  draw(LINKED, true)
  const link = screen.getByRole('link', { name: 'https://example.com/a' })
  const bubble = link.closest('p')!
  expect(bubble.className).toContain('bg-primary')
  expect(bubble.className).toContain('text-primary-foreground')
  expect(link.className).toContain('underline')
  expect(link.className).not.toContain('text-blue')
  expect(screen.queryByText('이재정')).toBeNull()
  expect(screen.queryByText('이')).toBeNull()
})

test('남의 메시지는 이름 첫 글자 얼굴과 이름 아래 테두리 말풍선이고 링크는 파란 글자다', () => {
  draw(LINKED)
  const link = screen.getByRole('link', { name: 'https://example.com/a' })
  const bubble = link.closest('p')!
  expect(bubble.className).toContain('border')
  expect(bubble.className).not.toContain('bg-primary')
  expect(link.className).toContain('text-blue')
  expect(screen.getByText('이재정')).toBeTruthy()
  expect(screen.getByText('이').getAttribute('aria-hidden')).toBe('true')
})

test('탈퇴한 사람의 얼굴은 첫 글자가 아니라 사람 아이콘이다', () => {
  draw(message('m2', '그동안 고마웠어요', { senderName: '떠난 운영진 2' }))
  expect(screen.getByText('떠난 운영진 2')).toBeTruthy()
  expect(screen.queryByText('떠')).toBeNull()
  expect(screen.getByRole('listitem').querySelector('svg.lucide-user')).toBeTruthy()
})

const REQUEST_ID = 'r-1'
const EXPENSE_ID = 'e-1'
const MADE = message('a2', '마커 사 주세요', {
  made: [
    { kind: 'purchase_request', id: REQUEST_ID, title: '마커 사기', blocking: true },
    { kind: 'expense', id: EXPENSE_ID, title: '마커 값', blocking: false },
  ],
})

const openMenu = () =>
  fireEvent.keyDown(screen.getByRole('button', { name: '메시지 동작' }), { key: 'Enter' })

// 022 정한 것 22: 메시지 아래에 만든 기록이 만든 차례로 있고, 누르면 그 상세 주소로 간다.
test('메시지 아래에 구매 요청·지출 기록이 있고 누르면 그 상세로 간다', () => {
  draw(MADE)
  const list = screen.getByRole('list', { name: '이 메시지로 만든 기록' })
  const lines = within(list).getAllByRole('button')
  expect(lines.map(line => line.textContent)).toEqual(['구매 요청 · 마커 사기', '지출 · 마커 값'])
  fireEvent.click(lines[0]!)
  expect(window.location.pathname).toContain(REQUEST_ID)
  fireEvent.click(lines[1]!)
  expect(window.location.pathname).toContain(EXPENSE_ID)
})

test('만든 기록이 없으면 기록 줄도 없다', () => {
  draw(message('a3', '그냥 말'))
  expect(screen.queryByRole('list', { name: '이 메시지로 만든 기록' })).toBeNull()
})

// 022 정한 것 23: 막는 기록이 있는 종류만 메뉴의 만들기 자리가 '… 보기'가 된다(요청과 지출은 서로 막지 않는다).
test('막는 요청이 있으면 메뉴는 구매 요청 보기이고, 막지 않는 지출뿐이면 지출 적기 그대로다', async () => {
  draw(MADE)
  openMenu()
  expect(await screen.findByRole('menuitem', { name: '구매 요청 보기' })).toBeTruthy()
  expect(screen.queryByRole('menuitem', { name: '구매 요청 만들기' })).toBeNull()
  expect(screen.getByRole('menuitem', { name: '지출 적기' })).toBeTruthy()
})

test('막는 지출이 있으면 메뉴는 지출 보기이고 누르면 그 지출로 간다', async () => {
  draw(
    message('a4', '영수증이요', {
      made: [{ kind: 'expense', id: 'e-9', title: '현수막 값', blocking: true }],
    }),
  )
  openMenu()
  expect(screen.queryByRole('menuitem', { name: '지출 적기' })).toBeNull()
  expect(await screen.findByRole('menuitem', { name: '구매 요청 만들기' })).toBeTruthy()
  fireEvent.click(screen.getByRole('menuitem', { name: '지출 보기' }))
  expect(window.location.pathname).toContain('e-9')
})

// 상품 정보 패널을 열 수 없는 곳(작업 공간 밖)에서는 쿠팡 링크도 보통 링크처럼 새 탭이다.
test('패널을 열 수 없는 곳에서는 쿠팡 링크도 새 탭 링크다', () => {
  const url = 'https://www.coupang.com/vp/products/1'
  draw(message('a5', url))
  const link = screen.getByRole('link', { name: url })
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('aria-haspopup')).toBeNull()
})
