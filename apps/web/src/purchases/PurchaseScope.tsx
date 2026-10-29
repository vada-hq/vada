import { isUuid } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { useEvents } from '@/events/useEvents'

type Props = {
  councilId: string
  scope: string | undefined
  onScope: (scope: string | null) => void
  onForbidden: () => void
}

// 구매 범위 칩(와이어프레임 PUR-00 01): 전체 · 상시 · 행사마다 하나. 행사에 속하지 않는 구매는 상시에서 본다(M-16).
export function PurchaseScope({ councilId, scope, onScope, onForbidden }: Props) {
  const events = useEvents(councilId, onForbidden)
  const list = events.state.kind === 'ready' ? events.state.data.events : []
  const chips = [
    { key: 'all', label: '전체', value: null },
    { key: 'none', label: '상시', value: 'none' },
    ...list.map(event => ({ key: event.id, label: event.name, value: event.id })),
  ]
  // 고른 행사가 최근 목록 밖이면(오래된 행사) 그 칩도 둔다.
  if (scope && isUuid(scope) && !list.some(event => event.id === scope))
    chips.push({ key: scope, label: '선택한 행사', value: scope })
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-sm font-medium text-fg-secondary">보기</span>
      <div role="group" aria-label="구매 범위" className="flex flex-wrap gap-2">
        {chips.map(chip => {
          const selected = (scope ?? null) === chip.value
          return (
            <Button
              key={chip.key}
              touch
              size="sm"
              variant={selected ? 'default' : 'outline'}
              aria-pressed={selected}
              className="max-w-60 rounded-full"
              onClick={() => onScope(chip.value)}
            >
              <span className="truncate">{chip.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
