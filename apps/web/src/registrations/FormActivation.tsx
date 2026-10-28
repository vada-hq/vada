import { FORM_ACTIVATION_CONDITIONS, type FormActivationCondition } from '@vada/contracts'
import { Check, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FORM_ACTIVATION_LABELS } from '@/lib/registration-messages'
import { FormSection } from './FormSection'

export function FormActivation({
  missing,
  onMove,
}: {
  missing: readonly FormActivationCondition[]
  onMove?: Partial<Record<FormActivationCondition, () => void>>
}) {
  return (
    <FormSection title="링크 활성화 조건">
      <ul className="flex flex-col divide-y text-sm">
        {FORM_ACTIVATION_CONDITIONS.map(condition => {
          const absent = missing.includes(condition)
          const move = onMove?.[condition]
          const Icon = absent ? Circle : Check
          return (
            <li key={condition} className="flex min-h-11 items-center gap-2 py-1">
              <Icon
                aria-hidden
                className={
                  absent
                    ? 'size-4 shrink-0 text-muted-foreground'
                    : 'size-4 shrink-0 text-green-600'
                }
              />
              <span className="min-w-0 flex-1 break-keep">{FORM_ACTIVATION_LABELS[condition]}</span>
              <span className="sr-only">{absent ? '미충족' : '충족'}</span>
              {absent && move && (
                <Button
                  variant="link"
                  size="sm"
                  touch
                  aria-label={`${FORM_ACTIVATION_LABELS[condition]} 이동`}
                  onClick={move}
                >
                  이동
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </FormSection>
  )
}
