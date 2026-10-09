import type { ReactNode } from 'react'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type Stat = { label: string; value: ReactNode; tone?: 'danger'; note?: ReactNode; action?: ReactNode }

// 숫자 묶음 카드. 표시만 한다. 숫자 계산과 문구는 쓰는 기능이 정하고, 열 수는 className으로 준다.
export function StatGrid({ label, stats, className }: { label: string; stats: Stat[]; className?: string }) {
  return <section aria-label={label} className={cn(cardClass, 'grid gap-2 p-4', className)}>
    {stats.map(stat => <div key={stat.label} className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-gray-500">{stat.label}</span>
      <span className={cn('text-sm font-semibold wrap-anywhere text-gray-900', stat.tone === 'danger' && 'text-destructive')}>{stat.value}</span>
      {stat.note && <span className="text-xs wrap-anywhere text-gray-500">{stat.note}</span>}
      {stat.action}
    </div>)}
  </section>
}
