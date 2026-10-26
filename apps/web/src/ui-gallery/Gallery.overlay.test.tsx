// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { LEAVE_CONFIRM, LEAVE_TITLE } from '@/lib/messages'
import { asElement } from '@/test-support/elements'
import { ExpenseCreateSection } from './ExpenseCreateSections'
import { EventEditSection } from './EventEditSections'
import { ActionMenuSection } from './MenuSections'
import { OrgInviteSection } from './OrgSections'
import { ConfirmSection, DialogSheetSection } from './OverlaySections'

// 부품 확인 화면의 대화상자·옆 메뉴·동작 메뉴·확인 창. 시험마다 그 묶음만 그린다(전체 화면은 Gallery.test.tsx).
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('대화상자 예시는 열고 X 버튼으로 닫을 수 있다', async () => {
  render(<DialogSheetSection />)
  fireEvent.click(screen.getByRole('button', { name: '대화상자 열기' }))
  expect(await screen.findByRole('dialog', { name: '새 행사' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('옆 메뉴 예시는 열고 닫기 버튼으로 닫을 수 있다', async () => {
  render(<DialogSheetSection />)
  fireEvent.click(screen.getByRole('button', { name: '옆 메뉴 열기' }))
  expect(await screen.findByRole('dialog', { name: '예시 메뉴' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('오른쪽 패널 예시는 열고 패널 닫기로 닫을 수 있다', async () => {
  render(<DialogSheetSection />)
  fireEvent.click(screen.getByRole('button', { name: '오른쪽 패널 열기' }))
  const panel = await screen.findByRole('dialog', { name: '예시 패널' })
  expect(panel.className).toContain('right-0')
  fireEvent.click(within(panel).getByRole('button', { name: '패널 닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('구성원 초대 창 예시는 휴대폰에서 아래, 넓은 화면에서 오른쪽에 열리고 닫기로 닫을 수 있다', async () => {
  render(<OrgInviteSection />)
  fireEvent.click(screen.getByRole('button', { name: '구성원 초대 창 열기' }))
  const sheet = await screen.findByRole('dialog', { name: '구성원 초대' })
  expect(sheet.className).toContain('bottom-0')
  expect(sheet.className).toContain('sm:right-0')
  expect(within(sheet).getByRole('heading', { name: '구성원 초대' })).toBeTruthy()
  fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('행사 기본정보 수정 패널 예시는 오른쪽에 높이 전체로 열리고(휴대폰은 전체 폭) 닫기로 닫을 수 있다', async () => {
  render(<EventEditSection />)
  fireEvent.click(screen.getByRole('button', { name: '기본정보 수정 패널 열기' }))
  const panel = await screen.findByRole('dialog', { name: '행사 기본정보 수정' })
  expect(panel.className).toContain('inset-y-0')
  expect(panel.className).toContain('w-full')
  expect(panel.className).toContain('sm:w-128')
  fireEvent.click(within(panel).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('동작 메뉴 예시는 키보드로 열고, 위험한 항목은 빨갛게 보인다', async () => {
  render(<ActionMenuSection />)
  fireEvent.keyDown(screen.getByRole('button', { name: '운영진 동작 예시' }), { key: 'Enter' })
  const menu = await screen.findByRole('menu')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['부서 배정', '부회장 직급 주기', '내보내기'])
  expect(within(menu).getByRole('menuitem', { name: '내보내기' }).className).toContain(
    'text-destructive',
  )
})

test('확인 대화상자 예시는 빨간 확인 버튼과 오류 문구를 보이고, 닫기로 닫는다', async () => {
  render(<ConfirmSection />)
  fireEvent.click(screen.getByRole('button', { name: '확인 대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  expect(within(dialog).getByRole('button', { name: '내보내기' }).className).toContain(
    'bg-destructive',
  )
  expect(within(dialog).getByRole('alert').textContent).toBe(
    '저장하지 못했어요. 다시 시도해 주세요.',
  )
  // 이름이 길어도 설명이 대화상자 밖으로 넘치지 않게 줄바꿈한다.
  expect(within(dialog).getByText(/^학생회 소속과 부서 소속이 함께 끝나요/).className).toContain(
    'wrap-anywhere',
  )
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('확인 대화상자의 일반 모양은 파란 확인 버튼이고 오류 문구가 없다', async () => {
  render(<ConfirmSection />)
  fireEvent.click(screen.getByRole('button', { name: '일반 확인 대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정님에게 회장 직급을 넘길까요?' })
  const confirm = within(dialog).getByRole('button', { name: '넘기기' })
  expect(confirm.className).toContain('bg-primary')
  expect(confirm.className).not.toContain('bg-destructive')
  expect(within(dialog).queryByRole('alert')).toBeNull()
  fireEvent.click(confirm)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('확인 대화상자의 보내는 중 모양은 두 버튼이 꺼지고 Escape로 닫히지 않으며, 예시는 잠시 뒤 저절로 닫힌다', async () => {
  render(<ConfirmSection />)
  fireEvent.click(screen.getByRole('button', { name: '보내는 중 확인 대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  expect(
    asElement(within(dialog).getByRole('button', { name: '내보내기' }), HTMLButtonElement).disabled,
  ).toBe(true)
  expect(
    asElement(within(dialog).getAllByRole('button', { name: '닫기' })[0]!, HTMLButtonElement)
      .disabled,
  ).toBe(true)
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.getByRole('dialog', { name: '박새내님을 내보낼까요?' })).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 4_000 })
})

test('확인 대화상자의 사유 꼭은 별표가 있고 늘 켜져 있으며, 사유 선택은 (선택)이다', async () => {
  render(<ConfirmSection />)
  fireEvent.click(screen.getByRole('button', { name: '사유 꼭 확인 대화상자 열기' }))
  const required = await screen.findByRole('dialog', { name: '이 지출을 취소할까요?' })
  expect(within(required).getByLabelText('취소 사유').getAttribute('aria-required')).toBe('true')
  expect(within(required).getByRole('button', { name: '지출 취소' })).toHaveProperty(
    'disabled',
    false,
  )
  fireEvent.click(within(required).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '사유 선택 확인 대화상자 열기' }))
  const optional = await screen.findByRole('dialog', { name: '이 행사를 완료할까요?' })
  expect(within(optional).getByText('(선택)')).toBeTruthy()
})

test('떠날 때 확인 대화상자는 입력을 버리고 나가는 빨간 버튼과 계속 쓰는 닫기를 보인다', async () => {
  render(<ConfirmSection />)
  fireEvent.click(screen.getByRole('button', { name: '떠날 때 확인 대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: LEAVE_TITLE })
  expect(within(dialog).getByRole('button', { name: LEAVE_CONFIRM }).className).toContain(
    'bg-destructive',
  )
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('지출 적기 표본은 1280·390 폭의 실제 칸과 필수 오류·금액 확인 창을 보여 준다', async () => {
  render(<ExpenseCreateSection />)
  const section = screen
    .getByRole('heading', { level: 2, name: '지출 적기 · 390' })
    .closest('section')!
  const scoped = within(section)
  expect(scoped.getByLabelText('사용처')).toHaveProperty('value', 'print.example.com')
  fireEvent.click(scoped.getByRole('button', { name: '적기' }))
  expect(scoped.getByText('결제 수단을 골라 주세요')).toBeTruthy()
  fireEvent.click(scoped.getByRole('button', { name: '금액 확인 창 열기' }))
  const confirm = await screen.findByRole('dialog', { name: '금액과 자릿수를 확인하세요' })
  fireEvent.click(within(confirm).getByRole('button', { name: '그래도 적기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
