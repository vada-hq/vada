import type { ReactNode } from 'react'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// 수 카드 하나: 이름과 (있으면) 그 화면으로 가는 링크, 큰 수, 보조 글. 수를 아직 못 읽었으면 그 자리에 이유를 쓴다.
// icon이 있으면 맨 위 줄에 아이콘과 링크를 두고 이름은 그 아래다(와이어프레임 FIN-00 재정 카드). valueClassName은 수의 색이다.
export function NumberCard({
  label,
  link,
  icon,
  value,
  valueClassName,
  sub,
  children,
}: {
  label: string
  link?: ReactNode
  icon?: ReactNode
  value: string | null
  valueClassName?: string
  sub: string
  children?: ReactNode
}) {
  return (
    <section aria-label={label} className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
      {icon && (
        <div className="mb-2 flex items-start justify-between gap-2">
          {icon}
          {link}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm text-fg-tertiary">{label}</h3>
        {!icon && link}
      </div>
      {value === null ? (
        <span className="py-1.5 text-sm text-fg-muted">{sub}</span>
      ) : (
        <>
          <span className={cn('text-2xl font-bold wrap-anywhere text-fg', valueClassName)}>
            {value}
          </span>
          <span className="text-xs text-fg-muted">{sub}</span>
        </>
      )}
      {children}
    </section>
  )
}
