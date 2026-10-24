import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Attention, AttentionTone } from './home-attention'

const NUMBER_TONE: Record<AttentionTone, string> = {
  danger: 'text-red-600',
  warning: 'text-yellow-700',
  info: 'text-blue-600',
}
// 숫자 칸은 네 개까지(와이어프레임 홈 위 줄)
const TILE_LIMIT = 4

const jump = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// 맨 위 숫자 카드 줄(와이어프레임 홈): 앞의 네 개를 0이어도 늘 같은 자리에 둔다. 0은 회색으로 둔다.
// 누르면 그 부분으로 내려간다.
export default function AttentionTiles({ items }: { items: Attention[] }) {
  return (
    <section aria-label="지금 볼 것" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.slice(0, TILE_LIMIT).map(item => (
        <Button
          key={item.key}
          variant="outline"
          className="h-auto flex-col items-start gap-1 bg-card p-4 text-left shadow-sm"
          onClick={() => jump(item.target)}
        >
          <span className="text-xs font-medium text-gray-500">{item.label}</span>
          <span
            className={cn(
              'text-2xl font-bold',
              item.count > 0 ? NUMBER_TONE[item.tone] : 'text-gray-300',
            )}
          >
            {item.count}
          </span>
        </Button>
      ))}
    </section>
  )
}
