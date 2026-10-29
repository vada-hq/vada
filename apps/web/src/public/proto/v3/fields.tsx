import { useId, type ReactNode } from 'react'
import { RadioGroup as RadioPrimitive } from 'radix-ui'
import type { FormQuestion } from '@vada/contracts'
import { cn } from '@/lib/utils'
import { radius, size, type } from './tokens'

// v3 신청 칸 부품: 이름표가 위에 있는 테두리 칸, 테두리 고르기 줄(짧은 선택지는 한 줄 타일).
// 앱 Field는 이름표가 12px라 이 안의 크기 대비(이름표 14 / 입력 16)와 맞지 않아 새로 그렸다. aria 잇기는 같다.

type Wire = { id: string; describedBy: string | undefined; invalid: boolean }

export function FieldRow(props: {
  label: string
  required: boolean
  error: string | undefined
  // 고르기 묶음은 label 대신 묶음 이름(aria-labelledby)으로 잇는다.
  group?: boolean
  children: (wire: Wire) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  const labelId = `${id}-label`
  // 긴 질문 글이 줄바꿈돼도 별표·'(선택)'이 글 끝에 바로 붙게 한 줄 흐름(inline)으로 둔다.
  const LabelTag = props.group ? 'span' : 'label'
  return (
    <div className="flex flex-col gap-2">
      <div className="break-keep wrap-anywhere">
        <LabelTag
          id={labelId}
          {...(!props.group && { htmlFor: id })}
          className={cn(type.label, 'font-semibold text-fg')}
        >
          {props.label}
        </LabelTag>
        {props.required ? (
          <span aria-hidden className={cn(type.label, 'ml-1 text-danger-emphasis')}>
            *
          </span>
        ) : (
          <span className={cn(type.small, 'ml-1 whitespace-nowrap text-fg-muted')}>(선택)</span>
        )}
      </div>
      {props.children({
        id: props.group ? labelId : id,
        describedBy: props.error ? errorId : undefined,
        invalid: Boolean(props.error),
      })}
      {props.error && (
        <p id={errorId} className={cn(type.label, 'text-danger-emphasis')}>
          {props.error}
        </p>
      )}
    </div>
  )
}

const boxClass = cn(
  'w-full min-w-0 border border-border-strong bg-white px-4 text-fg-body outline-none',
  'focus-visible:border-category-7-strong focus-visible:ring-2 focus-visible:ring-category-7-strong/25',
  'disabled:bg-surface-subtle disabled:text-fg-subtle aria-invalid:border-danger-emphasis',
  radius.control,
  size.control,
  type.body,
)

export function TextBox(props: {
  wire: Wire
  value: string
  busy: boolean
  required: boolean
  inputMode?: 'numeric' | 'tel'
  autoComplete?: string
  type?: 'text' | 'tel'
  onChange: (value: string) => void
}) {
  const { wire } = props
  return (
    <input
      id={wire.id}
      type={props.type ?? 'text'}
      className={boxClass}
      value={props.value}
      disabled={props.busy}
      inputMode={props.inputMode}
      autoComplete={props.autoComplete}
      aria-required={props.required || undefined}
      aria-invalid={wire.invalid || undefined}
      aria-describedby={wire.describedBy}
      onChange={event => props.onChange(event.target.value)}
    />
  )
}

// 선택지 글이 모두 짧고 넷 이하이면(S/M/L/XL) 한 줄 타일로 둔다. 세로 줄 넷보다 칸이 덜 밀린다.
const TILE_MAX = 4
const TILE_LABEL_MAX = 3
const asTiles = (question: FormQuestion) =>
  question.choices.length <= TILE_MAX &&
  question.choices.every(choice => choice.label.length <= TILE_LABEL_MAX)

const rowClass = cn(
  'flex w-full cursor-pointer items-center gap-3 border border-border-strong bg-white px-4 py-3 text-left text-fg-body',
  'outline-none focus-visible:ring-2 focus-visible:ring-category-7-strong/40 disabled:cursor-not-allowed disabled:opacity-60',
  'data-[state=checked]:border-border-selected data-[state=checked]:bg-surface-subtle data-[state=checked]:font-semibold data-[state=checked]:ring-1 data-[state=checked]:ring-border-selected data-[state=checked]:ring-inset',
  radius.control,
  size.control,
  type.body,
)

function Dot() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border-control bg-white">
      <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-fg" />
    </span>
  )
}

export function ChoiceRows(props: {
  wire: Wire
  question: FormQuestion
  value: string
  busy: boolean
  onChange: (value: string) => void
}) {
  const { wire, question } = props
  const tiles = asTiles(question)
  return (
    <RadioPrimitive.Root
      aria-labelledby={wire.id}
      aria-required={question.required || undefined}
      aria-invalid={wire.invalid || undefined}
      aria-describedby={wire.describedBy}
      // 칸 확인이 첫 문제 칸(aria-invalid)으로 초점을 옮길 수 있게 한다.
      tabIndex={-1}
      value={props.value}
      disabled={props.busy}
      onValueChange={props.onChange}
      className={cn(
        'outline-none',
        tiles ? 'grid grid-cols-4 gap-2' : 'flex flex-col gap-2',
        wire.invalid && '[&>button]:border-danger-emphasis',
      )}
    >
      {question.choices.map(choice => (
        <RadioPrimitive.Item
          key={choice.id}
          value={choice.id}
          className={cn(rowClass, tiles && 'justify-center gap-2 px-2')}
        >
          <Dot />
          <span className="min-w-0 break-keep wrap-anywhere">{choice.label}</span>
        </RadioPrimitive.Item>
      ))}
    </RadioPrimitive.Root>
  )
}

export function CheckRows(props: {
  wire: Wire
  question: FormQuestion
  value: string[]
  busy: boolean
  onChange: (value: string[]) => void
}) {
  const { wire, question, value } = props
  return (
    <div
      role="group"
      aria-labelledby={wire.id}
      aria-invalid={wire.invalid || undefined}
      aria-describedby={wire.describedBy}
      tabIndex={-1}
      className="flex flex-col gap-2 outline-none"
    >
      {question.choices.map(choice => (
        <label
          key={choice.id}
          className={cn(
            rowClass,
            'has-[:checked]:border-border-selected has-[:checked]:bg-surface-subtle has-[:checked]:font-semibold has-[:checked]:ring-1 has-[:checked]:ring-border-selected has-[:checked]:ring-inset',
          )}
        >
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-fg"
            checked={value.includes(choice.id)}
            disabled={props.busy}
            onChange={event =>
              props.onChange(
                event.target.checked
                  ? [...value, choice.id]
                  : value.filter(picked => picked !== choice.id),
              )
            }
          />
          <span className="min-w-0 break-keep wrap-anywhere">{choice.label}</span>
        </label>
      ))}
    </div>
  )
}
