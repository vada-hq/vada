import type { ReactNode } from 'react'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// 양식 만들기 화면의 묶음 하나. 운영진이 정하는 순서(행사 확인 → 기간·정원·안내 → 돈 → 받는 항목)대로 카드를 쌓는다.
export function FormSection({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section aria-label={title} className={cn(cardClass, 'flex flex-col gap-4 p-4')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}
