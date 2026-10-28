// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { resetAddress } from '@/test-support/address-reset'
import { windowHistoryIdle } from '@/lib/use-window-history'
import { BottomNavigationVisibility, useBottomNavigationHidden } from './BottomNavigationVisibility'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import { SidePanel, SidePanelContent } from './ui/side-panel'

afterEach(async () => {
  cleanup()
  await resetAddress()
})

function Tabs() {
  return (
    <nav aria-label="아래 탭" hidden={useBottomNavigationHidden()}>
      홈
    </nav>
  )
}
function Windows() {
  const [open, setOpen] = useState(false)
  const [nested, setNested] = useState(false)
  return (
    <BottomNavigationVisibility>
      <Tabs />
      <Button onClick={() => setOpen(true)}>패널 열기</Button>
      <SidePanel open={open} onOpenChange={setOpen}>
        <SidePanelContent title="전체 화면 패널">
          <Button onClick={() => setNested(true)}>확인 창 열기</Button>
          <Dialog open={nested} onOpenChange={setNested}>
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>확인 창</DialogTitle>
            </DialogContent>
          </Dialog>
        </SidePanelContent>
      </SidePanel>
    </BottomNavigationVisibility>
  )
}
test('전체 화면 패널 위 확인 창을 뒤로 닫아도 패널이 닫힐 때까지 탭을 숨긴다', async () => {
  render(<Windows />)
  expect(screen.getByRole('navigation', { name: '아래 탭' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '패널 열기' }))
  expect(screen.queryByRole('navigation', { name: '아래 탭' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '확인 창 열기' }))
  await windowHistoryIdle()
  act(() => window.history.back())
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '확인 창' })).toBeNull())
  expect(screen.getByRole('dialog', { name: '전체 화면 패널' })).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: '아래 탭' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await screen.findByRole('navigation', { name: '아래 탭' })
})
