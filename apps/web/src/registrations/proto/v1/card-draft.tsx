import { useRef } from 'react'
import { Check, ChevronRight, ListChecks, Play } from 'lucide-react'
import type { FormActivationCondition } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CardCondition, CardForm } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import { IconCircle, shake } from './parts'
import { size, space, type } from './tokens'

// 양식 카드 몸통(초안): GitHub 병합 상자식 한 문장(b14) + Shopify 설정 안내식 체크 줄(b13) + [설문 링크 활성화].

function doneValue(item: CardForm, key: FormActivationCondition, when: string) {
  if (key === 'event_starts_at') return when.split(' ~ ')[0] ?? ''
  if (key === 'closes_at') return item.text.period
  if (key === 'fee_account') return item.text.account ?? ''
  return ''
}

function CheckRow({
  condition,
  value,
  onFill,
}: {
  condition: CardCondition
  value: string
  onFill: () => void
}) {
  if (condition.done)
    return (
      <li className="flex min-h-12 items-center gap-3">
        <span className="grid size-5.5 shrink-0 place-items-center rounded-full bg-success-emphasis text-white">
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        </span>
        <span className={cn('flex-1 text-fg-muted', type.body)}>
          {condition.label}
          <span className="sr-only"> 끝남</span>
        </span>
        {value && <span className={cn('text-fg-muted max-sm:hidden', type.small)}>{value}</span>}
      </li>
    )
  return (
    <li>
      <button
        type="button"
        data-missing
        onClick={onFill}
        className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-lg px-2 text-left outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className="size-5.5 shrink-0 rounded-full border-2 border-border-strong"
        />
        <span className={cn('flex-1 font-semibold text-fg', type.body)}>
          {condition.label}
          <span className="sr-only"> 빠짐</span>
        </span>
        <span className={cn('flex items-center font-medium text-primary-strong', type.body)}>
          채우기
          <ChevronRight aria-hidden className="size-4" />
        </span>
      </button>
    </li>
  )
}

// 초안: 막힌 이유 한 문장 → 체크 줄 넷 → [설문 링크 활성화](늘 켜 둠, 빠졌으면 첫 빠진 줄을 흔든다)
export function DraftBody({ item, props }: { item: CardForm; props: BuilderProps }) {
  const list = useRef<HTMLUListElement>(null)
  const missing = item.conditions.filter(condition => !condition.done).length
  const total = item.conditions.length
  const fill = (key: FormActivationCondition) =>
    key === 'event_starts_at' ? props.onEditEvent('startsAt') : props.onFill(item.form.id, key)
  const activate = () => {
    if (missing === 0) return props.onActivate(item.form.id)
    shake(list.current?.querySelector('[data-missing]') ?? null)
  }
  return (
    <div className={cn('flex flex-col gap-3 pb-4', space.cardX)}>
      <div className="flex items-center gap-3">
        {missing === 0 ? (
          <span
            aria-hidden
            className={cn(
              'grid shrink-0 place-items-center rounded-full bg-success-surface text-success',
              size.iconCircle,
            )}
          >
            <Play className="size-4" />
          </span>
        ) : (
          <IconCircle>
            <ListChecks />
          </IconCircle>
        )}
        <div className="flex flex-col">
          <p className={cn('font-semibold text-fg', type.body)}>
            {missing === 0 ? '링크 열 준비 완료' : `링크를 열기 전에 ${missing}개를 채워 주세요`}
          </p>
          <p className={cn('text-fg-muted', type.small)}>
            {total}개 중 {total - missing}개 끝남
          </p>
        </div>
      </div>
      <ul ref={list} className="divide-y divide-border-subtle border-y border-border-subtle">
        {item.conditions.map(condition => (
          <CheckRow
            key={condition.key}
            condition={condition}
            value={doneValue(item, condition.key, props.data.eventText.when)}
            onFill={() => fill(condition.key)}
          />
        ))}
      </ul>
      {item.form.actions.includes('form.activate') && (
        <Button className="h-11 w-full" onClick={activate}>
          설문 링크 활성화
        </Button>
      )}
    </div>
  )
}
