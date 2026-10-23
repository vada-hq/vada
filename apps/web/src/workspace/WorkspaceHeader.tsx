import type { Ref } from 'react'
import { ChevronRight, Menu as MenuIcon } from 'lucide-react'
import { pageWidthClass } from '@/components/PageColumn'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  councilName: string
  section: string | null
  title: string
  onMenu: () => void
  menuRef?: Ref<HTMLButtonElement>
  // 페이지 행동(PageActions)이 들어올 자리
  actionsRef?: Ref<HTMLDivElement>
}

// 머리글: 경로와 제목, 오른쪽에 페이지 행동. 본문과 같은 폭으로 가운데에 모은다.
// 제목은 앱 페이지 제목 범위(20~24px, Polaris·Primer 20, Atlassian 24)의 아래 끝이다.
// 옆 메뉴가 숨는 폭(768px 미만)에서만 메뉴 버튼을 보여 준다.
export default function WorkspaceHeader({
  councilName,
  section,
  title,
  onMenu,
  menuRef,
  actionsRef,
}: Props) {
  return (
    <header className="shrink-0 border-b bg-white px-4 py-3 sm:px-6">
      <div className={cn(pageWidthClass, 'flex min-h-11 items-center gap-3')}>
        <Button
          ref={menuRef}
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="메뉴 열기"
          onClick={onMenu}
        >
          <MenuIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <span className="truncate">{councilName}</span>
            {section && (
              <>
                <ChevronRight aria-hidden className="size-3 shrink-0" />
                <span className="shrink-0 text-gray-600">{section}</span>
              </>
            )}
          </p>
          <h1 className="mt-0.5 truncate text-xl font-bold text-gray-900">{title}</h1>
        </div>
        <div ref={actionsRef} className="flex shrink-0 items-center gap-2" />
      </div>
    </header>
  )
}
