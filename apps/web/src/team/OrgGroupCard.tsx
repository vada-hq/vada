import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  // 제목 앞 표시(회장단의 별, 부서 색 점).
  icon?: ReactNode
  // 제목 옆 표시(재정 역할 배지).
  badge?: ReactNode
  // 머리 오른쪽의 작은 글(인원, 부장이 없으면 '부장 없음'). 회장단 카드는 와이어프레임처럼 없다.
  meta?: string
  // 머리 오른쪽 끝(부서 ⋯ 메뉴).
  action?: ReactNode
  // 머리 자리를 대신하는 제자리 편집(이름 바꾸기). 있으면 제목은 화면 읽기 프로그램에만 남는다.
  editor?: ReactNode
  reveal?: boolean
  className?: string
  // 카드 몸통(사람 카드들, 부서면 부장 칸과 부원 칸).
  children: ReactNode
}

// 조직도의 카드 하나(와이어프레임 ORG-03A의 회장단 카드·부서 카드): 한 줄 머리(제목, 배지, 인원, ⋯)와 몸통.
// reveal이면 그 카드로 스크롤하고 초점을 옮긴다(홈의 '재정 담당 없음'·'부장 정하기').
export function OrgGroupCard({ title, icon, badge, meta, action, editor, ...props }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!props.reveal) return
    ref.current?.scrollIntoView?.({ block: 'start' })
    ref.current?.focus({ preventScroll: true })
  }, [props.reveal])
  return (
    <section
      ref={ref}
      tabIndex={props.reveal ? -1 : undefined}
      aria-labelledby={titleId}
      className={cn(cardClass, 'flex min-w-0 flex-col', props.className)}
    >
      <div className="flex min-h-11 items-center gap-2 border-b px-4 py-1.5">
        {editor ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {editor}
          </>
        ) : (
          <>
            <h2
              id={titleId}
              className="flex min-w-0 items-center gap-2 text-sm font-semibold wrap-anywhere text-fg"
            >
              {icon}
              {title}
            </h2>
            {badge}
            {meta && <p className="ml-auto shrink-0 text-xs text-fg-muted">{meta}</p>}
            {action}
          </>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">{props.children}</div>
    </section>
  )
}
