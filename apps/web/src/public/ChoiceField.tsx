import { useId } from 'react'
import { Check } from 'lucide-react'
import type { FormQuestion } from '@vada/contracts'
import { cn } from '@/lib/utils'
import { ErrorLine, LabelText, RequiredMark } from './FilledField'
import { field, fieldFrame, radius, type } from './public-look'

// 짧은 선택지(4개 이하, 모두 3자 이하: S/M/L/XL)는 한 줄 타일, 아니면 세로 줄이다.
const TILE_MAX_CHOICES = 4
const TILE_MAX_LABEL = 3
const asTiles = (question: FormQuestion) =>
  question.kind === 'single_choice' &&
  question.choices.length <= TILE_MAX_CHOICES &&
  question.choices.every(choice => choice.label.length <= TILE_MAX_LABEL)

// 줄 전체가 누르는 면이고 입력칸과 같은 높이(48px)·테두리다. 고르면 파란 테두리 + 옅은 파란 면 + 굵은 글.
// 색만으로 말하지 않게 왼쪽 표시가 함께 찬다.
const ROW = cn(
  'relative flex cursor-pointer items-center transition-colors',
  fieldFrame,
  field,
  radius.field,
  type.body,
  'text-fg-body active:bg-surface-subtle has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary-border',
  'data-checked:border-primary-emphasis data-checked:bg-primary-surface data-checked:font-semibold data-checked:text-primary-strong',
)

// 고르는 표시는 늘 왼쪽에 있다: 하나 고르기는 동그라미, 여럿 고르기는 네모. 무엇을 몇 개 고르는지 바로 보인다.
function Mark({ on, multiple }: { on: boolean; multiple: boolean }) {
  const look = on
    ? 'bg-primary-emphasis text-white'
    : 'bg-white text-transparent ring-1 ring-border-strong ring-inset'
  return (
    <span
      aria-hidden="true"
      data-mark={multiple ? 'checkbox' : 'radio'}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center',
        multiple ? 'rounded-md' : 'rounded-full',
        look,
      )}
    >
      {multiple ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : (
        <span className={cn('size-2 rounded-full', on ? 'bg-white' : 'bg-transparent')} />
      )}
    </span>
  )
}

type Row = {
  name: string
  label: string
  on: boolean
  multiple: boolean
  tile: boolean
  disabled: boolean
  onPick: (on: boolean) => void
}

// 실제 radio·checkbox는 화면에서만 숨겨 키보드·화면 읽기·자동 채움이 브라우저 기본대로 돈다. 모양은 줄과 표시가 맡는다.
function ChoiceRow({ name, label, on, multiple, tile, disabled, onPick }: Row) {
  return (
    <label
      data-checked={on || undefined}
      className={cn(ROW, tile ? 'justify-center gap-2 px-3' : 'gap-3 px-4 py-2.5')}
    >
      <input
        type={multiple ? 'checkbox' : 'radio'}
        name={name}
        checked={on}
        disabled={disabled}
        className="sr-only"
        onChange={event => onPick(event.target.checked)}
      />
      <Mark on={on} multiple={multiple} />
      <span className={cn('wrap-anywhere', tile ? 'text-center' : 'min-w-0 flex-1')}>{label}</span>
    </label>
  )
}

// 고르기 질문 하나: 이름표 + 큰 누름 줄들 + 그 아래 오류. 칸 확인이 첫 문제 칸으로 초점을 옮길 수 있게 묶음에 tabIndex를 둔다.
export function ChoiceField({
  question,
  value,
  error,
  disabled,
  onAnswer,
}: {
  question: FormQuestion
  value: string | string[] | undefined
  error: string | undefined
  disabled: boolean
  onAnswer: (value: string | string[]) => void
}) {
  const id = useId()
  const multiple = question.kind === 'multiple_choice'
  const tile = asTiles(question)
  const picked = Array.isArray(value) ? value : value ? [value] : []
  const pick = (choiceId: string, on: boolean) => {
    if (!multiple) return onAnswer(choiceId)
    onAnswer(on ? [...picked, choiceId] : picked.filter(item => item !== choiceId))
  }
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={`${id}-label`}
      aria-required={question.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-2 outline-none"
    >
      <div className="flex items-baseline">
        <LabelText id={`${id}-label`} label={question.title} />
        <RequiredMark required={question.required} />
      </div>
      <div className={tile ? 'grid grid-cols-4 gap-2' : 'flex flex-col gap-2'}>
        {question.choices.map(choice => (
          <ChoiceRow
            key={choice.id}
            name={`${id}-${question.id}`}
            label={choice.label}
            on={picked.includes(choice.id)}
            multiple={multiple}
            tile={tile}
            disabled={disabled}
            onPick={on => pick(choice.id, on)}
          />
        ))}
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
    </div>
  )
}
