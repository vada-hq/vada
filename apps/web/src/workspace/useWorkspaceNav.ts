import { useEffect, useRef, useState } from 'react'
import { appPath, menuPath, parseAppPath, recordPath } from '@vada/contracts'
import { navigate, useHere } from '@/lib/app-location'
import { withTaskLayout, withTaskTab } from '@/lib/task-layout'
import { useWideNavigation } from '@/lib/use-wide-navigation'
import type { Opener, Page } from './pages'

// 보고 있는 쪽은 주소가 정한다. 768px 미만에서 옆 메뉴로 연 시트는 메뉴를 고르면 닫는다.
// 업무 메뉴로 가는 링크에는 그 사람이 마지막에 고른 배치를 싣는다(memberId, 학생회를 읽기 전에는 null).
// 학생회를 고르면 작업 공간은 새로 그려진다. 고른 곳(옆 메뉴의 학생회 이름 버튼, 휴대폰에서는 아래 메뉴 탭)으로 포커스를 돌려놓는다.
export function useWorkspaceNav(
  returnFocusTo: Opener | null,
  councilId: string,
  page: Page,
  memberId: string | null,
) {
  const here = useHere()
  const [navOpen, setNavOpen] = useState(false)
  const wide = useWideNavigation()
  useEffect(() => {
    if (wide) setNavOpen(false)
  }, [wide])
  const councilMenu = useRef<HTMLButtonElement>(null)
  const mobileMenu = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    if (returnFocusTo) (returnFocusTo === 'sidebar' ? councilMenu : mobileMenu).current?.focus()
  }, [returnFocusTo])
  // 옆 메뉴로 가는 곳: 한 칸 쌓는다. 이미 그곳이면 칸을 쌓지 않고 맨 위로만 올린다.
  const go = (target: string) => {
    setNavOpen(false)
    const parsed = parseAppPath(here.path)
    if (parsed && appPath(parsed) === target) {
      if (main.current) main.current.scrollTop = 0
    } else navigate(target)
  }
  return {
    page,
    navOpen,
    setNavOpen,
    councilMenu,
    mobileMenu,
    main,
    closeNav: () => setNavOpen(false),
    // 메뉴를 누르면 첫 화면으로 간다. 업무의 탭·배치는 주소가 원문이므로 기억한 값을 링크에 싣는다.
    openPage: (next: Page) =>
      go(
        menuPath(
          next,
          councilId,
          next === 'tasks' ? withTaskLayout(memberId, withTaskTab(memberId, {}), false) : {},
        ),
      ),
    // '행사' 묶음의 줄을 누르면 그 행사의 첫 탭으로 간다.
    openEvent: (eventId: string) => go(recordPath('events', councilId, eventId)),
  }
}
