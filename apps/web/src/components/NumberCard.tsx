import type { ReactNode } from 'react'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// 수 카드 하나: 이름과 (있으면) 그 화면으로 가는 링크, 큰 수, 보조 글. 수를 아직 못 읽었으면 그 자리에 이유를 쓴다.
export function NumberCard({
  label,
  link,
  value,
  sub,
  children,
}: {
  label: string
  link?: ReactNode
  value: string | null
  sub: string
  children?: ReactNode
}) {
  return (
    <section aria-label={label} className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm text-gray-600">{label}</h3>
        {link}
      </div>
      {value === null ? (
        <span className="py-1.5 text-sm text-gray-500">{sub}</span>
      ) : (
        <>
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          <span className="text-xs text-gray-500">{sub}</span>
        </>
      )}
      {children}
    </section>
  )
}
