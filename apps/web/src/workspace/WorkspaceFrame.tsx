import type { ReactNode } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { Opener } from './pages'

type Props = {
  // 옆 메뉴. 데스크톱 aside와 휴대폰 시트가 각각 만든다.
  sidebar: (from: Opener) => ReactNode
  navOpen: boolean
  onNavOpenChange: (open: boolean) => void
  // 오른쪽 1:1 패널(022 조각 7). 열렸을 때만 있다. 자리와 폭은 패널이 정한다.
  panel?: ReactNode
  children: ReactNode
}

// 작업 공간의 틀: 왼쪽 옆 메뉴(768px 미만에서는 시트)와 오른쪽 머리글·본문.
export default function WorkspaceFrame({
  sidebar,
  navOpen,
  onNavOpenChange,
  panel,
  children,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col"
        aria-label="학생회 작업 공간"
      >
        {sidebar('sidebar')}
      </aside>
      <Sheet open={navOpen} onOpenChange={onNavOpenChange}>
        <SheetContent title="학생회 작업 공간">{sidebar('header')}</SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {panel}
    </div>
  )
}
