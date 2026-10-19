import type { Ref } from 'react'
import { ChevronRight, Menu as MenuIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = { councilName: string; section: string; title: string; onMenu: () => void; menuRef?: Ref<HTMLButtonElement> }

// 와이어프레임 헤더(56px): 경로(상위 gray-400, 마지막 gray-600)와 제목. 옆 메뉴가 숨는 폭(768px 미만)에서만 메뉴 버튼을 보여 준다.
export default function WorkspaceHeader({ councilName, section, title, onMenu, menuRef }: Props) {
  return <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-4 sm:px-6">
    <Button ref={menuRef} variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기" onClick={onMenu}><MenuIcon /></Button>
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1 text-xs text-gray-400">
        <span className="truncate">{councilName}</span>
        <ChevronRight aria-hidden className="size-3 shrink-0" />
        <span className="shrink-0 text-gray-600">{section}</span>
      </p>
      <h1 className="mt-0.5 truncate text-base font-semibold text-gray-900">{title}</h1>
    </div>
  </header>
}
