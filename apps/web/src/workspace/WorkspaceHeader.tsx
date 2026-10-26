import type { Ref } from 'react'
import { ChevronRight, Menu as MenuIcon } from 'lucide-react'
import type { Crumb } from '@/components/PageHeading'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  // 경로 줄의 칸. 맨 앞은 학생회 이름이다(pages.ts trailOf).
  crumbs: Crumb[]
  title: string
  onMenu: () => void
  menuRef?: Ref<HTMLButtonElement>
  // 페이지 행동(PageActions)이 들어올 자리
  actionsRef?: Ref<HTMLDivElement>
}

// 경로 줄: 작은 회색 글을 > 아이콘으로 잇고 마지막 칸만 진하다. 칸은 누를 수 없다(와이어프레임 사이드바 v6.2).
// 색은 와이어프레임(gray-400, 마지막 gray-600)보다 한 단계 진하다(작은 글의 대비 4.5:1, WCAG 1.4.3).
function Trail({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <ol aria-label="경로" className="flex min-w-0 items-center gap-1 text-xs text-gray-500">
      {crumbs.map((crumb, index) => (
        <li
          // 같은 이름의 칸이 둘일 수 있어(조직 > 조직) 차례를 키로 쓴다.
          key={index}
          className={cn('flex items-center gap-1', crumb.truncate ? 'min-w-0' : 'shrink-0')}
        >
          {index > 0 && <ChevronRight aria-hidden className="size-3 shrink-0" />}
          <span
            className={cn(
              crumb.truncate && 'truncate',
              index === crumbs.length - 1 && 'text-gray-700',
            )}
            title={crumb.truncate ? crumb.label : undefined}
          >
            {crumb.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

// 머리글(와이어프레임 사이드바 v6.2 OPS-TASK-01·EVT-02): 높이 h-16, 남은 폭을 다 쓰고 왼쪽에 붙는다.
// 경로 줄과 제목, 오른쪽에 페이지 행동. 좌우 여백은 본문(main)과 같아 제목과 본문의 왼쪽 줄이 맞는다.
// 제목 크기는 vada 페이지 제목(text-xl, 앱 페이지 제목 범위 20~24px의 아래 끝, Polaris·Primer 20), 굵기는 와이어프레임대로 semibold다.
// 행사명은 행사 화면에서 이 제목에만 있어, 휴대폰(768px 미만)에서는 두 줄까지 보이고 머리글이 그만큼 높아진다.
// 넓은 화면은 한 줄 말줄임이고 올리면 전체 이름이다. 옆 메뉴가 숨는 폭(768px 미만)에서만 메뉴 버튼을 보여 준다.
export default function WorkspaceHeader({ crumbs, title, onMenu, menuRef, actionsRef }: Props) {
  return (
    <header className="flex min-h-16 shrink-0 items-center gap-4 border-b bg-white px-4 py-2 sm:px-6">
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
        <Trail crumbs={crumbs} />
        <h1
          className="mt-0.5 line-clamp-2 text-xl font-semibold text-gray-900 wrap-anywhere md:line-clamp-1"
          title={title}
        >
          {title}
        </h1>
      </div>
      <div ref={actionsRef} className="flex shrink-0 items-center gap-2" />
    </header>
  )
}
