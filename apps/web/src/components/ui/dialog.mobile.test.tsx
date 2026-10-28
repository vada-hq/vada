// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { resetAddress } from '@/test-support/address-reset'
import { windowHistoryIdle } from '@/lib/use-window-history'
import {
  BottomNavigationVisibility,
  useBottomNavigationHidden,
} from '@/components/BottomNavigationVisibility'
import { Button } from './button'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from './dialog'

afterEach(async () => {
  cleanup()
  await resetAddress()
})

// 640 이상(데스크탑 시연)의 창 모양은 휴대폰 시트를 더하기 전과 같아야 한다.
const WIDE_CONTENT = [
  'relative',
  'flex',
  'w-full',
  'max-w-lg',
  'flex-col',
  'gap-6',
  'rounded-lg',
  'border',
  'bg-white',
  'p-6',
  'shadow-2xl',
  'outline-none',
  'data-[state=open]:animate-in',
  'data-[state=open]:fade-in-0',
  'data-[state=open]:zoom-in-95',
]
const WIDE_OVERLAY = [
  'fixed',
  'inset-0',
  'z-50',
  'grid',
  'place-items-center',
  'overflow-y-auto',
  'bg-black/45',
  'p-4',
  'data-[state=open]:animate-in',
  'data-[state=open]:fade-in-0',
]
const WIDE_FOOTER = ['flex', 'flex-wrap', 'justify-end', 'gap-2']

const wide = (element: Element) =>
  [...element.classList].filter(name => !name.startsWith('max-sm:'))
const narrow = (element: Element) =>
  [...element.classList].filter(name => name.startsWith('max-sm:')).map(name => name.slice(7))

function Tabs() {
  return (
    <nav aria-label="아래 탭" hidden={useBottomNavigationHidden()}>
      홈
    </nav>
  )
}

function Form() {
  const [open, setOpen] = useState(false)
  return (
    <BottomNavigationVisibility>
      <Tabs />
      <Button onClick={() => setOpen(true)}>요청 만들기</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>구매 요청</DialogTitle>
          <input aria-label="품목" />
          <DialogFooter data-testid="footer">
            <Button>요청 보내기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BottomNavigationVisibility>
  )
}

async function open() {
  render(<Form />)
  const opener = screen.getByRole('button', { name: '요청 만들기' })
  opener.focus()
  fireEvent.click(opener)
  return { opener, dialog: await screen.findByRole('dialog', { name: '구매 요청' }) }
}

test('640 이상의 창·바깥·버튼 줄 class는 그대로다', async () => {
  const { dialog } = await open()
  expect(wide(dialog)).toEqual(WIDE_CONTENT)
  expect(wide(dialog.parentElement!)).toEqual(WIDE_OVERLAY)
  expect(wide(screen.getByTestId('footer'))).toEqual(WIDE_FOOTER)
})

test('640 아래에서 창은 아래에 붙은 전체 폭 시트이고 넘치면 창 안이 스크롤된다', async () => {
  const { dialog } = await open()
  expect(narrow(dialog)).toEqual(
    expect.arrayContaining([
      'fixed',
      'inset-x-0',
      'bottom-0',
      'max-w-none',
      'max-h-dvh',
      'overflow-y-auto',
      'scroll-pb-20',
      'rounded-b-none',
      'rounded-t-xl',
    ]),
  )
})

test('640 아래에서 버튼 줄은 시트 바닥에 붙고 바닥 안전 영역을 비운다', async () => {
  await open()
  expect(narrow(screen.getByTestId('footer'))).toEqual(
    expect.arrayContaining(['sticky', '-bottom-6', 'bg-white', 'border-t', 'safe-bottom-3']),
  )
})

test('시트로 열려도 초점은 창 안에 있고 아래 탭을 숨기며, 닫으면 탭과 초점이 돌아온다', async () => {
  const { opener, dialog } = await open()
  expect(dialog.contains(document.activeElement)).toBe(true)
  expect(screen.queryByRole('navigation', { name: '아래 탭' })).toBeNull()
  await windowHistoryIdle()
  window.history.back()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await screen.findByRole('navigation', { name: '아래 탭' })
  await waitFor(() => expect(document.activeElement).toBe(opener))
})

test('창 밖 페이지의 버튼 줄(구매 요청 내기)은 바닥에 붙이지 않는다', () => {
  render(<DialogFooter data-testid="page-footer" />)
  expect(narrow(screen.getByTestId('page-footer'))).toEqual([])
})
