import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Room, type RoomPage } from './ChatPage'
import type { DirectTarget } from './useDirectPanel'

// 1:1 패널의 틀(와이어프레임 MSG-04 사이드챗, DEC-90): 호박색 머리에 상대 이름과 [닫기], 아래에 그 방.
// 1280px 이상은 작업 공간 오른쪽에 붙어 본문을 줄이고(Slack split view), 768~1279px은 본문이 좁아지지 않게 오른쪽 위에 겹쳐 뜨며,
// 768px 미만(휴대폰)은 전체 화면이다. 뒤 화면을 막지 않아 다른 이름을 누르면 패널이 그 사람으로 바뀐다.
// 폭은 와이어프레임 340px의 1/0.875(약 388px)에 가까운 w-96이다. 열리면 머리로 포커스를 옮기고 Esc로 닫는다.
export function DirectPanelFrame({
  name,
  onClose,
  children,
}: {
  name: string
  onClose: () => void
  children: ReactNode
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [name])
  return (
    <aside
      aria-label={`${name} 1:1 대화`}
      className="fixed inset-0 z-40 flex flex-col bg-white md:left-auto md:w-96 md:border-l-2 md:border-amber-300 md:shadow-2xl xl:static xl:z-auto xl:shrink-0 xl:shadow-none"
      onKeyDown={event => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 py-2 pr-2 pl-4">
        <h2
          ref={heading}
          tabIndex={-1}
          className="min-w-0 text-base font-semibold wrap-anywhere text-amber-950 outline-none"
        >
          {name}
        </h2>
        <Badge tone="warning" className="shrink-0">
          1:1
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          touch
          className="ml-auto text-amber-800 hover:bg-amber-100 hover:text-amber-950"
          aria-label="닫기"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-3">{children}</div>
    </aside>
  )
}

// 연 사람의 1:1 방. 여는 중이면 자리 표시, 열지 못했으면 이유, 열었으면 대화 화면과 같은 방이다(보내기 버튼만 '{이름}에게 보내기').
export default function DirectPanel({
  page,
  target,
  onClose,
}: {
  page: RoomPage
  target: DirectTarget
  onClose: () => void
}) {
  const { name } = target.person
  return (
    <DirectPanelFrame name={name} onClose={onClose}>
      {target.kind === 'opening' && <StateMessage kind="loading">1:1 대화 여는 중…</StateMessage>}
      {target.kind === 'failed' && <StateMessage kind="error">{target.error}</StateMessage>}
      {target.kind === 'open' && (
        <Room
          key={target.roomId}
          page={page}
          roomId={target.roomId}
          sendLabel={`${name}에게 보내기`}
        />
      )}
    </DirectPanelFrame>
  )
}
