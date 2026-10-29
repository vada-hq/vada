import {
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  MessageSquare,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { QUESTION_KIND_LABELS, type QuestionKind } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { FieldErrors } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'
import { newChoice, withKind, type QuestionDraft } from '../../question-draft'
import { FoldCard } from './fold-card'
import { LockedLine, SwitchRow } from './parts'
import { type } from './tokens'

// 추가 질문 한 장(구글폼 질문 카드 b01). 위: 질문 글 + 종류, 가운데: 선택지 줄, 아래 띠: 차례·복사·지우기·필수.

const KINDS = Object.keys(QUESTION_KIND_LABELS) as QuestionKind[]

export const questionMissing = (draft: QuestionDraft) =>
  Number(draft.title.trim() === '') +
  (draft.kind === 'short_text' ? 0 : draft.choices.filter(choice => !choice.label.trim()).length)

function questionSummary(draft: QuestionDraft) {
  const choices = draft.kind === 'short_text' ? null : draft.choices.map(c => c.label).join(', ')
  return [QUESTION_KIND_LABELS[draft.kind], draft.required ? '필수' : '선택', choices]
    .filter(Boolean)
    .join(' · ')
}

type Moves = {
  onChange: (draft: QuestionDraft) => void
  onMove: (step: -1 | 1) => void
  onCopy: () => void
  onRemove: () => void
}

function Choices({
  draft,
  at,
  errors,
  onChange,
}: {
  draft: QuestionDraft
  at: number
  errors: FieldErrors
  onChange: (draft: QuestionDraft) => void
}) {
  const Mark = draft.kind === 'single_choice' ? Circle : Square
  const label = (order: number, text: string) =>
    onChange({
      ...draft,
      choices: draft.choices.map((choice, n) =>
        n === order ? { ...choice, label: text } : choice,
      ),
    })
  return (
    <div className="flex flex-col gap-2">
      {draft.choices.map((choice, order) => {
        const error = errors[`questions.${at}.choices.${order}.label`]
        return (
          <div key={choice.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Mark aria-hidden className="size-4 shrink-0 text-fg-subtle" />
              <Input
                aria-label={`선택지 ${order + 1}`}
                aria-invalid={error ? true : undefined}
                value={choice.label}
                onChange={event => label(order, event.target.value)}
              />
              {draft.choices.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  touch
                  aria-label={`선택지 ${order + 1} 지우기`}
                  onClick={() =>
                    onChange({ ...draft, choices: draft.choices.filter((_, n) => n !== order) })
                  }
                >
                  <X aria-hidden />
                </Button>
              )}
            </div>
            {error && <p className="pl-6 text-xs text-danger-emphasis">{error}</p>}
          </div>
        )
      })}
      <Button
        type="button"
        variant="ghost"
        touch
        className="self-start text-primary-strong"
        onClick={() =>
          onChange({ ...draft, choices: [...draft.choices, newChoice(draft.choices.length + 1)] })
        }
      >
        <Plus aria-hidden />
        선택지 추가
      </Button>
    </div>
  )
}

function Band({
  draft,
  first,
  last,
  moves,
}: {
  draft: QuestionDraft
  first: boolean
  last: boolean
  moves: Moves
}) {
  const icon = (label: string, Icon: typeof Copy, onClick: () => void, hidden = false) =>
    !hidden && (
      <Button type="button" variant="ghost" size="icon" touch aria-label={label} onClick={onClick}>
        <Icon aria-hidden />
      </Button>
    )
  return (
    <div className="-mx-1 flex flex-wrap items-center gap-1 border-t border-border-subtle pt-2">
      {icon('위로', ArrowUp, () => moves.onMove(-1), first)}
      {icon('아래로', ArrowDown, () => moves.onMove(1), last)}
      <span className="flex-1" />
      {icon('질문 복사', Copy, moves.onCopy)}
      {icon('질문 지우기', Trash2, moves.onRemove)}
      <span aria-hidden className="mx-2 h-6 w-px bg-border-default" />
      <div className="w-24">
        <SwitchRow
          label="필수"
          checked={draft.required}
          onChange={required => moves.onChange({ ...draft, required })}
        />
      </div>
    </div>
  )
}

export function QuestionCard({
  draft,
  at,
  count,
  open,
  locked,
  errors,
  onToggle,
  toolbar,
  ...moves
}: Moves & {
  draft: QuestionDraft
  at: number
  count: number
  open: boolean
  locked: boolean
  errors: FieldErrors
  onToggle: () => void
  toolbar?: React.ReactNode
}) {
  return (
    <FoldCard
      icon={<MessageSquare />}
      title={draft.title.trim() || '새 질문'}
      summary={questionSummary(draft)}
      missing={questionMissing(draft)}
      open={open && !locked}
      locked={locked}
      onToggle={locked ? () => {} : onToggle}
      toolbar={toolbar}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field label="질문" required error={errors[`questions.${at}.title`]}>
          <Input
            value={draft.title}
            onChange={event => moves.onChange({ ...draft, title: event.target.value })}
          />
        </Field>
        <Field label="종류">
          <NativeSelect
            value={draft.kind}
            onChange={event => moves.onChange(withKind(draft, event.target.value as QuestionKind))}
          >
            {KINDS.map(kind => (
              <option key={kind} value={kind}>
                {QUESTION_KIND_LABELS[kind]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {draft.kind !== 'short_text' && (
        <Choices draft={draft} at={at} errors={errors} onChange={moves.onChange} />
      )}
      <Band draft={draft} first={at === 0} last={at === count - 1} moves={moves} />
    </FoldCard>
  )
}

// 질문 묶음 머리(쟁반 위 작은 글): '추가 질문 3'
export function QuestionsLabel({ count, locked }: { count: number; locked: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 pt-3">
      <p className={cn('font-semibold text-fg-tertiary', type.small)}>추가 질문 {count}</p>
      {locked && <LockedLine>신청이 있어 항목은 바꿀 수 없어요</LockedLine>}
    </div>
  )
}
