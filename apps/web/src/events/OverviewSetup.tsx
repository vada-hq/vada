import { CheckCircle2, Circle } from 'lucide-react'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { OverviewLink } from './OverviewLink'
import type { SetupKey, SetupStep } from './overview-view'

type Props = {
  steps: SetupStep[]
  // 단계마다 그 일을 바로 하는 곳으로 간다. 없으면(권한이 없으면) 링크를 두지 않는다.
  actions: Partial<Record<SetupKey, { label: string; run: () => void }>>
}

// 준비 시작하기: 새 행사에서 할 일을 순서대로 보이고, 단계마다 그 일을 바로 하는 길을 둔다.
// 빈 화면은 무엇이 올지와 첫 할 일로 가는 길을 보여 준다(NN/g, 빈 화면). 단계 목록은 Shopify 설정 안내와 같은 모양이다.
export function OverviewSetup({ steps, actions }: Props) {
  const done = steps.filter(step => step.done).length
  return (
    <section aria-labelledby="overview-setup" className={cn(cardClass, 'px-4 py-3')}>
      <div className="flex items-baseline justify-between gap-2 pb-1">
        <h3 id="overview-setup" className="text-sm font-semibold text-gray-900">
          준비 시작하기
        </h3>
        <span className="text-xs text-gray-500">{`${steps.length}단계 중 ${done}단계 끝남`}</span>
      </div>
      <ol className="divide-y">
        {steps.map(step => {
          const action = step.done ? undefined : actions[step.key]
          return (
            <li key={step.key} className="flex items-start gap-3 py-3">
              {step.done ? (
                <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-green-600" />
              ) : (
                <Circle aria-hidden className="mt-0.5 size-5 shrink-0 text-gray-300" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    'text-sm font-medium',
                    step.done ? 'text-gray-500 line-through' : 'text-gray-900',
                  )}
                >
                  {step.title}
                  {step.optional && !step.done && (
                    <span className="ml-1.5 text-xs font-normal text-gray-500">필요할 때</span>
                  )}
                  {step.done && <span className="sr-only"> (끝남)</span>}
                </span>
                {!step.done && <span className="text-xs text-gray-500">{step.detail}</span>}
              </div>
              {action && (
                <OverviewLink className="shrink-0" onClick={action.run}>
                  {action.label}
                </OverviewLink>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
