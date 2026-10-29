import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2, X } from 'lucide-react'
import {
  FORM_QUESTION_MAX,
  QUESTION_CHOICE_MAX,
  QUESTION_KIND_LABELS,
  QUESTION_KINDS,
  type QuestionKind,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { FieldErrors } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'
import {
  hasQuestionError,
  newChoice,
  newDraft,
  withKind,
  type QuestionDraft,
} from '../../question-draft'
import { TinyPill } from './parts'
import { AddQuestion, KIND_ICON } from './question-add'

// 받는 항목 안의 추가 질문: 작은 줄 목록(종류 아이콘 + 질문 글 + '필수' 알약). 줄을 누르면 그 아래에서 질문 칸이 펼쳐진다.

type EditProps = {
  draft: QuestionDraft
  at: number
  count: number
  errors: FieldErrors
  onChange: (draft: QuestionDraft) => void
  onMove: (step: number) => void
  onRemove: () => void
}

function Choices({ draft, at, errors, onChange }: EditProps) {
  const setLabel = (key: string, label: string) =>
    onChange({ ...draft, choices: draft.choices.map(c => (c.key === key ? { ...c, label } : c)) })
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-medium text-fg-secondary">선택지</legend>
      {draft.choices.map((choice, order) => (
        <div key={choice.key} className="flex items-start gap-1">
          <Field
            label={`선택지 ${order + 1}`}
            className="min-w-0 grow [&>div:first-child]:sr-only"
            error={errors[`questions.${at}.choices.${order}.label`]}
          >
            <Input value={choice.label} onChange={e => setLabel(choice.key, e.target.value)} />
          </Field>
          {draft.choices.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              touch
              aria-label={`선택지 ${order + 1} 빼기`}
              onClick={() =>
                onChange({ ...draft, choices: draft.choices.filter(c => c.key !== choice.key) })
              }
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
      ))}
      {draft.choices.length < QUESTION_CHOICE_MAX && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          touch
          className="-ml-2 self-start text-primary-strong"
          onClick={() =>
            onChange({ ...draft, choices: [...draft.choices, newChoice(draft.choices.length + 1)] })
          }
        >
          <Plus aria-hidden />
          선택지
        </Button>
      )}
    </fieldset>
  )
}

function QuestionFields(props: EditProps) {
  const { draft, at, count, errors, onChange, onMove, onRemove } = props
  const tool = 'text-fg-tertiary'
  return (
    <div className="flex flex-col gap-4 px-3 pt-1 pb-3">
      <Field label="질문" required error={errors[`questions.${at}.title`]}>
        <Input
          data-field={`questions.${at}.title`}
          value={draft.title}
          onChange={e => onChange({ ...draft, title: e.target.value })}
        />
      </Field>
      <Field label="질문 종류">
        <NativeSelect
          value={draft.kind}
          onChange={e => onChange(withKind(draft, e.target.value as QuestionKind))}
        >
          {QUESTION_KINDS.map(kind => (
            <option key={kind} value={kind}>
              {QUESTION_KIND_LABELS[kind]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Label className="flex items-center gap-2 font-normal max-sm:min-h-11">
        <input
          type="checkbox"
          className="size-4 accent-primary-emphasis"
          checked={draft.required}
          onChange={e => onChange({ ...draft, required: e.target.checked })}
        />
        필수 응답
      </Label>
      {draft.kind !== 'short_text' && <Choices {...props} />}
      <div className="-mx-2 flex items-center gap-1 border-t border-border-subtle pt-2">
        {at > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touch
            className={tool}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden />
            위로
          </Button>
        )}
        {at < count - 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touch
            className={tool}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden />
            아래로
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          touch
          className="ml-auto text-danger"
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
          질문 지우기
        </Button>
      </div>
    </div>
  )
}

function QuestionRow({
  draft,
  open,
  locked,
  onToggle,
}: {
  draft: QuestionDraft
  open: boolean
  locked: boolean
  onToggle: () => void
}) {
  const Icon = KIND_ICON[draft.kind]
  const inner = (
    <>
      <Icon aria-label={QUESTION_KIND_LABELS[draft.kind]} className="text-fg-muted" />
      <span className="min-w-0 grow truncate text-sm font-medium text-fg">
        {draft.title.trim() || '새 질문'}
      </span>
      {draft.required && <TinyPill>필수</TinyPill>}
    </>
  )
  if (locked)
    return <div className="flex min-h-11 items-center gap-2 px-3 [&_svg]:size-4">{inner}</div>
  return (
    <Button
      type="button"
      variant="ghost"
      touch
      aria-expanded={open}
      className="h-auto min-h-11 w-full justify-start rounded-none px-3 text-left"
      onClick={onToggle}
    >
      {inner}
      <ChevronDown aria-hidden className={cn('text-fg-muted', open && 'rotate-180')} />
    </Button>
  )
}

type Props = {
  questions: QuestionDraft[]
  locked: boolean
  errors: FieldErrors
  onChange: (questions: QuestionDraft[]) => void
}

export function QuestionList({ questions, locked, errors, onChange }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const replace = (draft: QuestionDraft) =>
    onChange(questions.map(item => (item.key === draft.key ? draft : item)))
  function move(at: number, step: number) {
    const next = [...questions]
    const [item] = next.splice(at, 1)
    next.splice(at + step, 0, item!)
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-fg-secondary">추가 질문</p>
      {questions.length > 0 && (
        <ol
          aria-label="질문 목록"
          className="flex flex-col divide-y divide-border-subtle rounded-lg border border-default bg-white"
        >
          {questions.map((draft, at) => {
            const open = !locked && (openKey === draft.key || hasQuestionError(errors, at))
            return (
              <li key={draft.key} className={cn(open && 'bg-surface-subtle')}>
                <QuestionRow
                  draft={draft}
                  open={open}
                  locked={locked}
                  onToggle={() => setOpenKey(openKey === draft.key ? null : draft.key)}
                />
                {open && (
                  <QuestionFields
                    draft={draft}
                    at={at}
                    count={questions.length}
                    errors={errors}
                    onChange={replace}
                    onMove={step => move(at, step)}
                    onRemove={() => onChange(questions.filter(item => item.key !== draft.key))}
                  />
                )}
              </li>
            )
          })}
        </ol>
      )}
      {!locked && questions.length < FORM_QUESTION_MAX && (
        <AddQuestion
          onAdd={kind => {
            const draft = newDraft(kind)
            onChange([...questions, draft])
            setOpenKey(draft.key)
          }}
        />
      )}
    </div>
  )
}
