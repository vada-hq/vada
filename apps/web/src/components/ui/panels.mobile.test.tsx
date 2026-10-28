// @vitest-environment jsdom
import { StrictMode, useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { navigationWidth } from '@/test-support/navigation-width'
import { resetAddress } from '@/test-support/address-reset'
import {
  BottomNavigationVisibility,
  useBottomNavigationHidden,
} from '@/components/BottomNavigationVisibility'
import { Button } from './button'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import { Sheet, SheetContent } from './sheet'
import { SidePanel, SidePanelContent } from './side-panel'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const KINDS = ['panel', 'left', 'right', 'adaptive'] as const
type Kind = (typeof KINDS)[number]

function Content({ kind, children }: { kind: Kind; children: ReactNode }) {
  return kind === 'panel' ? (
    <SidePanelContent title="업무 패널">{children}</SidePanelContent>
  ) : (
    <SheetContent title="시트" side={kind} closeLabel="닫기">
      {children}
    </SheetContent>
  )
}

function Tabs() {
  return (
    <nav aria-label="아래 탭" hidden={useBottomNavigationHidden()}>
      홈
    </nav>
  )
}

function Windows({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false)
  const [nested, setNested] = useState(false)
  const Root = kind === 'panel' ? SidePanel : Sheet
  return (
    <BottomNavigationVisibility>
      <Tabs />
      <Button onClick={() => setOpen(true)}>열기</Button>
      <Root open={open} onOpenChange={setOpen}>
        <Content kind={kind}>
          <Button onClick={() => setNested(true)}>확인 창 열기</Button>
          <Dialog open={nested} onOpenChange={setNested}>
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>확인 창</DialogTitle>
            </DialogContent>
          </Dialog>
        </Content>
      </Root>
    </BottomNavigationVisibility>
  )
}

test.each(KINDS)(
  '390의 %s 위 확인 창을 닫아도 숨김을 유지하고 마지막 닫기에 초점을 복원한다',
  async (kind: Kind) => {
    navigationWidth(390)
    render(
      <StrictMode>
        <Windows kind={kind} />
      </StrictMode>,
    )
    const tabs = screen.getByRole('navigation', { name: '아래 탭' })
    const opener = screen.getByRole('button', { name: '열기' })
    opener.focus()
    fireEvent.click(opener)
    const panel = await screen.findByRole('dialog')
    expect(tabs.hidden).toBe(true)
    expect(screen.queryByRole('navigation', { name: '아래 탭' })).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: '확인 창 열기' }))
    const confirm = await screen.findByRole('dialog', { name: '확인 창' })
    fireEvent.click(within(confirm).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '확인 창' })).toBeNull())
    expect(tabs.hidden).toBe(true)
    fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))
    await waitFor(() => {
      expect(tabs.hidden).toBe(false)
      expect(document.activeElement).toBe(opener)
    })
  },
)

test.each(KINDS)('390의 %s 닫기는 44px 터치 영역이고 아이콘은 16px다', async (kind: Kind) => {
  navigationWidth(390)
  render(<Windows kind={kind} />)
  fireEvent.click(screen.getByRole('button', { name: '열기' }))
  const close = within(await screen.findByRole('dialog')).getByRole('button', { name: '닫기' })
  expect(close.classList.contains('max-sm:size-11')).toBe(true)
  expect(close.classList.contains('max-sm:items-center')).toBe(true)
  expect(close.classList.contains('max-sm:justify-center')).toBe(true)
  expect(close.classList.contains('size-11')).toBe(false)
  expect(close.querySelector('svg')?.classList.contains('size-4')).toBe(true)
})
