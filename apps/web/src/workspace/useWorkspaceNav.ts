import { useEffect, useRef, useState } from 'react'
import type { Opener, Page } from './pages'

// 보고 있는 쪽(사람, 부서, 설정)과 768px 미만에서 옆 메뉴로 연 시트. 메뉴를 고르면 시트를 닫는다.
// 학생회를 고르면 작업 공간은 새로 그려진다. 고른 곳(옆 메뉴의 학생회 이름 버튼, 휴대폰 폭에서는 헤더의 메뉴 열기 버튼)으로 포커스를 돌려놓는다.
export function useWorkspaceNav(returnFocusTo: Opener | null) {
  const [page, setPage] = useState<Page>('people')
  const [navOpen, setNavOpen] = useState(false)
  const councilMenu = useRef<HTMLButtonElement>(null)
  const headerMenu = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (returnFocusTo) (returnFocusTo === 'sidebar' ? councilMenu : headerMenu).current?.focus()
  }, [returnFocusTo])
  return {
    page,
    navOpen,
    setNavOpen,
    councilMenu,
    headerMenu,
    closeNav: () => setNavOpen(false),
    openPage: (next: Page) => {
      setNavOpen(false)
      setPage(next)
    },
  }
}
