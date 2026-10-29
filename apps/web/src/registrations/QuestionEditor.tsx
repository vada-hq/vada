import { useState } from 'react'
import { X } from 'lucide-react'
import {
  FORM_QUESTION_MAX,
  QUESTION_CHOICE_MAX,
  QUESTION_KIND_LABELS,
  QUESTION_KINDS,
  type QuestionKind,
} from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
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
} from './question-draft'

type Props = {
  questions: QuestionDraft[]
  // 신청이 한 명이라도 있으면 질문을 바꾸지 않는다(서버도 409, DEC-93). 목록만 보인다.
  locked: boolean
  disabled: boolean
  errors: FieldErrors
  onChange: (questions: QuestionDraft[]) => void
}

type EditProps = {
  draft: QuestionDraft
  at: number
  disabled: boolean
  errors: FieldErrors
  onChange: (draft: QuestionDraft) => void
}

// 고르기 질문의 선택지들. 하나는 늘 남기고, 상한까지 더한다.
function ChoiceFields({ draft, at, disabled, errors, onChange }: EditProps) {
  const setLabel = (key: string, label: string) =>
    onChange({
      ...draft,
      choices: draft.choices.map(choice => (choice.key === key ? { ...choice, label } : choice)),
    })
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-xs font-medium text-gray-700">선택지</legend>
      {draft.choices.map((choice, order) => (
        <div key={choice.key} className="flex items-start gap-2">
          <Field
            label={`선택지 ${order + 1}`}
            className="min-w-0 grow [&>div:first-child]:sr-only"
            error={errors[`questions.${at}.choices.${order}.label`]}
          >
            <Input
              value={choice.label}
              onChange={event => setLabel(choice.key, event.target.value)}
            />
          </Field>
          {draft.choices.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`선택지 ${order + 1} 빼기`}
              onClick={() =>
                onChange({
                  ...draft,
                  choices: draft.choices.filter(item => item.key !== choice.key),
                })
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
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            onChange({ ...draft, choices: [...draft.choices, newChoice(draft.choices.length + 1)] })
          }
        >
          선택지 추가
        </Button>
      )}
    </fieldset>
  )
}

// 펼친 질문의 설정(와이어프레임 EVT-05 '질문 설정': 질문, 종류, 필수). 고르기면 선택지가 더 있다.
function QuestionSettings(props: EditProps) {
  const { draft, at, disabled, errors, onChange } = props
  return (
    <div className="flex flex-col gap-4 border-t p-4">
      <Field label="질문" required error={errors[`questions.${at}.title`]}>
        <Input
          value={draft.title}
          disabled={disabled}
          onChange={event => onChange({ ...draft, title: event.target.value })}
        />
      </Field>
      <Field label="질문 종류">
        <NativeSelect
          className="max-sm:min-h-11"
          value={draft.kind}
          disabled={disabled}
          onChange={event => onChange(withKind(draft, event.target.value as QuestionKind))}
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
          className="size-4 accent-blue-600"
          checked={draft.required}
          disabled={disabled}
          onChange={event => onChange({ ...draft, required: event.target.checked })}
        />
        필수 응답
      </Label>
      {draft.kind !== 'short_text' && <ChoiceFields {...props} />}
    </div>
  )
}

// 질문 카드의 머리: 제목, 필수 칩, 종류 칩, 빼기. 누르면 설정을 펼치거나 접는다.
function QuestionHead(props: {
  draft: QuestionDraft
  open: boolean
  editable: boolean
  disabled: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const { draft, open, editable } = props
  const title = draft.title.trim() || '새 질문'
  // 필수 칩은 제목 바로 뒤, 종류 칩은 오른쪽 끝이다(와이어프레임 EVT-05 '설문 문항').
  const required = draft.required && <Badge tone="info">필수</Badge>
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {editable ? (
        <Button
          type="button"
          variant="ghost"
          className="min-w-0 shrink grow justify-start px-1 text-left text-gray-900"
          aria-expanded={open}
          busy={props.disabled}
          onClick={props.onToggle}
        >
          <span className="truncate font-medium">{title}</span>
          {required}
        </Button>
      ) : (
        <span className="flex min-w-0 grow items-center gap-2 px-1 text-sm font-medium">
          <span className="truncate">{title}</span>
          {required}
        </span>
      )}
      <Badge>{QUESTION_KIND_LABELS[draft.kind]}</Badge>
      {editable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${title} 빼기`}
          busy={props.disabled}
          onClick={props.onRemove}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  )
}

// 받는 항목의 질문 목록과 질문 추가(와이어프레임 EVT-05 '설문 문항'·'질문 추가'). 설정은 고른 카드 안에서 펼친다.
// 이름·학번·휴대폰은 위의 체크칸이 다룬다. 질문은 저장 버튼으로 양식과 함께 보낸다.
export function QuestionEditor({ questions, locked, disabled, errors, onChange }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const replace = (draft: QuestionDraft) =>
    onChange(questions.map(item => (item.key === draft.key ? draft : item)))
  function add(kind: QuestionKind) {
    const draft = newDraft(kind)
    onChange([...questions, draft])
    setOpenKey(draft.key)
  }
  return (
    <div className="flex flex-col gap-2">
      {locked && questions.length > 0 && (
        <p className="text-xs text-gray-500">신청이 있어 질문을 바꿀 수 없어요.</p>
      )}
      {questions.length > 0 && (
        <ol aria-label="질문 목록" className="flex flex-col gap-2">
          {questions.map((draft, at) => {
            const open = !locked && (openKey === draft.key || hasQuestionError(errors, at))
            return (
              <li key={draft.key} className={cn(cardClass, open && 'border-blue-300')}>
                <QuestionHead
                  draft={draft}
                  open={open}
                  editable={!locked}
                  disabled={disabled}
                  onToggle={() => setOpenKey(openKey === draft.key ? null : draft.key)}
                  onRemove={() => onChange(questions.filter(item => item.key !== draft.key))}
                />
                {open && (
                  <QuestionSettings
                    draft={draft}
                    at={at}
                    disabled={disabled}
                    errors={errors}
                    onChange={replace}
                  />
                )}
              </li>
            )
          })}
        </ol>
      )}
      {!locked && questions.length < FORM_QUESTION_MAX && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
          <span className="text-xs text-gray-500">질문 추가</span>
          {QUESTION_KINDS.map(kind => (
            <Button
              type="button"
              key={kind}
              variant="outline"
              size="sm"
              busy={disabled}
              onClick={() => add(kind)}
            >
              {QUESTION_KIND_LABELS[kind]}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
