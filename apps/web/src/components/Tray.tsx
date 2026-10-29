import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// 홈 구역의 회색 쟁반(회장단 홈 ① f8 확정 시안). 쟁반 위에 머리(TrayHead)와 흰 묶음(TrayGroup)을 놓는다.
// 구역은 자기 칸 폭으로 모양을 정한다: 쟁반을 감싼 @container가 그 칸의 폭이고, 안의 @2xl:은 이 폭을 본다.
// 배치는 이 부품을 놓기만 하고 모양을 덮어쓰지 않는다.
export function Tray({
  labelledBy,
  children,
  className,
}: {
  labelledBy: string
  children: ReactNode
  className?: string | undefined
}) {
  return (
    <div className="@container min-w-0">
      <section
        aria-labelledby={labelledBy}
        className={cn('rounded-tray bg-muted p-2 @2xl:p-2.5', className)}
      >
        {children}
      </section>
    </div>
  )
}

// 쟁반 머리: 구역 이름과 건수. 왼쪽 끝을 묶음 안 줄의 아이콘 원 왼쪽 끝에 맞춘다(쟁반 + 묶음 + 줄 안쪽 여백의 합).
// lead는 이름 앞에 두는 것(③ 내가 할 일의 내 얼굴). 있으면 얼굴과 글의 가운데를 맞춘다.
export function TrayHead({
  id,
  title,
  count,
  lead,
}: {
  id: string
  title: string
  count?: number
  lead?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex px-4.5 pt-3 pb-2 @2xl:px-5.5 @2xl:pt-3.5 @2xl:pb-3',
        lead ? 'items-center gap-2.5' : 'items-baseline gap-2',
      )}
    >
      {lead}
      <h2 className="min-w-0 text-xl font-bold tracking-tight break-keep text-fg" id={id}>
        {title}
      </h2>
      {count !== undefined && (
        <span className="shrink-0 text-xl font-bold tracking-tight text-fg-tertiary">{count}</span>
      )}
    </div>
  )
}

// 쟁반 위 흰 묶음(줄 목록)
export function TrayGroup({ children }: { children: ReactNode }) {
  return <ul className="rounded-group bg-card p-1.5 @2xl:p-2">{children}</ul>
}
