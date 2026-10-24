import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  // 옆 메뉴와 같은 아이콘. 부분을 훑을 때 첫 단서가 된다.
  icon?: LucideIcon | undefined
  // 맨 위 '지금 볼 것'에서 이 부분으로 내려온다.
  id?: string | undefined
  count?: number | string | undefined
  // 머리 오른쪽의 짧은 수(지남 2 · 담당자 없음 3)
  aside?: ReactNode
  // 원래 목록 화면으로 간다.
  onSeeAll?: (() => void) | undefined
  // 줄(<li>)들
  children: ReactNode
  // 줄 목록 아래 한 줄(줄로 보이지 않은 것의 수)
  footer?: ReactNode
}

// 홈의 한 부분: 업무 화면의 묶음과 같은 꼴로 머리(이름·수·모두 보기) 아래 줄 목록 한 장을 둔다.
export default function HomeSection({
  title,
  icon: Icon,
  id,
  count,
  aside,
  onSeeAll,
  children,
  footer,
}: Props) {
  return (
    <section id={id} aria-label={title} className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 wrap-anywhere">
          {Icon && <Icon aria-hidden className="size-4 text-gray-500" />}
          {title}
          {count !== undefined && <span className="font-normal text-gray-500">{count}</span>}
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-3">
          {aside}
          {onSeeAll && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onSeeAll}>
              모두 보기
            </Button>
          )}
        </div>
      </div>
      <ul className={cn(cardClass, 'divide-y')}>{children}</ul>
      {footer && <p className="px-1 text-xs text-gray-500">{footer}</p>}
    </section>
  )
}

// 줄이 없을 때 목록 안에 한 줄로 그렇다고 알린다.
export function HomeEmpty({ children }: { children: ReactNode }) {
  return <li className="px-4 py-3 text-sm text-gray-500">{children}</li>
}
