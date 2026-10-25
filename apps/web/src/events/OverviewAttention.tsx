import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { EventTab } from './event-view'
import { OverviewLink } from './OverviewLink'
import type { Attention, AttentionKey } from './overview-view'

const VALUE_TONE: Record<Attention['tone'], string> = {
  danger: 'text-red-600',
  warning: 'text-yellow-700',
  info: 'text-blue-700',
}
const GOES_TO: Record<AttentionKey, { tab: EventTab; label: string }> = {
  overdue: { tab: 'tasks', label: '업무 보기' },
  unassigned: { tab: 'tasks', label: '업무 보기' },
  settlement: { tab: 'money', label: '예산·정산 보기' },
  complete: { tab: 'money', label: '예산·정산 보기' },
}

const DOT_TONE: Record<Attention['tone'], string> = {
  danger: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
}

// 챙길 것: 막힌 업무와 끝난 행사의 정산. 줄마다 수와 앞의 몇 개, 그 일을 하는 탭으로 가는 링크다(와이어프레임 Event Overview의 주의 칸).
// 아래 수 카드와 무게가 겹치지 않게 큰 수 카드가 아니라 한 장의 목록으로 둔다. 챙길 것이 없으면 아무것도 그리지 않는다.
export function OverviewAttention({
  items,
  onTab,
  onUnassigned,
}: {
  items: Attention[]
  onTab: (tab: EventTab) => void
  // '담당자 없음'은 업무 탭을 그 줄이 보이는 보기(담당자 없음)로 연다. 업무 전부를 보이지 않는다.
  onUnassigned: () => void
}) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="overview-attention" className={cn(cardClass, 'px-4 py-3')}>
      <h3 id="overview-attention" className="pb-1 text-sm font-semibold text-gray-900">
        챙길 것
      </h3>
      <ul className="divide-y">
        {items.map(item => (
          <li key={item.key} className="flex items-start gap-3 py-2.5">
            <span
              aria-hidden
              className={cn('mt-2 size-2 shrink-0 rounded-full', DOT_TONE[item.tone])}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm text-gray-900">
                {item.title}
                {item.value && (
                  <span className={cn('ml-1.5 font-semibold', VALUE_TONE[item.tone])}>
                    {item.value}
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-500 wrap-anywhere">{item.detail}</span>
            </div>
            <OverviewLink
              className="shrink-0"
              onClick={() =>
                item.key === 'unassigned' ? onUnassigned() : onTab(GOES_TO[item.key].tab)
              }
            >
              {GOES_TO[item.key].label}
            </OverviewLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
