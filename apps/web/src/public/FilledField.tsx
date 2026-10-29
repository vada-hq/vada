import { useId, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { field, fieldFrame, radius, type } from './public-look'

const LABEL = `${type.label} font-semibold text-fg-secondary wrap-anywhere`

// 이름표 뒤 표시: 필수는 빨간 별표, 선택은 '(선택)'. 이름표 요소 밖에 두어 칸의 이름은 이름표 글 그대로다(Field와 같다).
export function RequiredMark({ required }: { required: boolean }) {
  return required ? (
    <span aria-hidden="true" className="ml-0.5 text-danger-emphasis">
      *
    </span>
  ) : (
    <span className={`ml-1 ${type.label} text-fg-muted`}>(선택)</span>
  )
}

export function LabelText({ id, label }: { id: string; label: string }) {
  return (
    <span id={id} className={LABEL}>
      {label}
    </span>
  )
}

export function ErrorLine({ id, error }: { id: string; error: string | undefined }) {
  if (!error) return null
  return (
    <p id={id} className={`${type.label} font-medium text-danger`}>
      {error}
    </p>
  )
}

// 흰 바탕 + 옅은 테두리 칸(48px, 글자 17px). 초점이면 파란 테두리 + 옅은 파란 고리, 틀리면 빨간 테두리 + 칸 아래 빨간 한 줄.
const FILLED = cn(
  'px-4 py-2.5 text-fg-body sm:text-row-title',
  fieldFrame,
  field,
  radius.field,
  type.body,
  'focus-visible:border-primary-emphasis focus-visible:ring-3 focus-visible:ring-primary-border',
  'aria-invalid:border-danger-emphasis aria-invalid:focus-visible:ring-danger-border disabled:bg-surface-subtle',
)

// 이름표가 위에 있는 칸 하나(NN/g placeholder: 이름표는 칸 밖 위).
export function FilledField({
  label,
  required,
  error,
  ...input
}: { label: string; required: boolean; error: string | undefined } & ComponentProps<'input'>) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline">
        <Label htmlFor={id} className={LABEL}>
          {label}
        </Label>
        <RequiredMark required={required} />
      </div>
      <Input
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={FILLED}
        {...input}
      />
      <ErrorLine id={errorId} error={error} />
    </div>
  )
}
