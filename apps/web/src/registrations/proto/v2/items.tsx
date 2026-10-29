import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { QuestionKind } from '@vada/contracts'
import type { FieldErrors } from '@/lib/use-form-check'
import { newChoice, newDraft, withKind, type QuestionDraft } from '../../question-draft'
import { collectsStudentId, type FormValues } from '../../registration-form'
import { ErrorLine, LockNote, MoreMenu, Switch, TextAction, type MenuItem } from './parts'
import { radius, size, space, type } from './tokens'

// 받는 항목 = 학생 화면 모양 그대로(굵은 질문 글 + 회색 채운 칸·선택 줄). 질문 글·선택지를 그 자리에서 고친다(Tally b05, Notion 폼 b06).
// 질문 설정(필수·종류·차례·지우기)은 질문마다 ••• 하나에 모은다. 데스크탑은 흐리게 두고 올리면 또렷, 터치는 늘 또렷.

type Change = (patch: Partial<FormValues>, key?: string) => void

const KIND_NAMES: Record<QuestionKind, string> = {
  short_text: '짧은 답',
  single_choice: '하나 고르기',
  multiple_choice: '여럿 고르기',
}
const KINDS = Object.keys(KIND_NAMES) as QuestionKind[]

const INLINE =
  '-ml-2 rounded-lg bg-transparent px-2 outline-none hover:bg-surface-muted focus:bg-surface-muted focus:ring-2 focus:ring-primary-emphasis aria-invalid:ring-2 aria-invalid:ring-danger-emphasis read-only:hover:bg-transparent read-only:focus:ring-0'
const QUESTION_TEXT = `${type.body} font-semibold text-fg-secondary`
const FILLED_BOX = `${size.filled} ${radius.filled} bg-surface-muted`

function Star({ required }: { required: boolean }) {
  return required ? (
    <span aria-hidden="true" className="ml-0.5 text-danger-emphasis">
      *
    </span>
  ) : (
    <span className={`ml-1 ${type.small} font-normal text-fg-muted`}>(선택)</span>
  )
}

// 이름·학번·휴대폰: 이름은 늘 받음(잠금), 학번은 두 참가비가 다르면 잠금, 휴대폰은 켜기 끄기.
function BasicItem({
  label,
  on,
  lock,
  onToggle,
}: {
  label: string
  on: boolean
  lock?: string | undefined
  onToggle?: (on: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className={on ? QUESTION_TEXT : `${type.body} font-semibold text-fg-muted`}>
          {label}
          {on ? (
            <Star required />
          ) : (
            <span className={`ml-1.5 ${type.small} font-normal`}>받지 않음</span>
          )}
        </span>
        {lock ? (
          <LockNote>{lock}</LockNote>
        ) : (
          <Switch on={on} label={`${label} 받기`} onChange={value => onToggle?.(value)} />
        )}
      </div>
      {on && <div aria-hidden="true" className={FILLED_BOX} />}
    </div>
  )
}

function Basics({
  values,
  locked,
  onChange,
}: {
  values: FormValues
  locked: boolean
  onChange: Change
}) {
  const studentLock = values.feeKind === 'split' ? '납부자 금액 다름' : undefined
  return (
    <>
      <BasicItem label="이름" on lock="늘 받음" />
      <BasicItem
        label="학번"
        on={collectsStudentId(values)}
        lock={locked ? '잠김' : studentLock}
        onToggle={on => onChange({ collectsStudentId: on })}
      />
      <BasicItem
        label="휴대폰 번호"
        on={values.collectsPhone}
        lock={locked ? '잠김' : undefined}
        onToggle={on => onChange({ collectsPhone: on })}
      />
    </>
  )
}

function Mark({ multiple }: { multiple: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center bg-white ring-1 ring-border-strong ring-inset ${multiple ? 'rounded-md' : 'rounded-full'}`}
    >
      {multiple && <Check className="size-4 text-transparent" />}
    </span>
  )
}

type QuestionProps = {
  draft: QuestionDraft
  at: number
  count: number
  locked: boolean
  errors: FieldErrors
  set: (draft: QuestionDraft, key?: string) => void
  move: (at: number, by: number) => void
  remove: (at: number) => void
}

function menuOf({ draft, at, count, set, move, remove }: QuestionProps): MenuItem[] {
  return [
    {
      label: '필수',
      on: draft.required,
      onPick: () => set({ ...draft, required: !draft.required }),
    },
    ...KINDS.filter(kind => kind !== draft.kind).map(kind => ({
      label: `${KIND_NAMES[kind]}로 바꾸기`,
      onPick: () => set(withKind(draft, kind)),
    })),
    ...(at > 0 ? [{ label: '위로', onPick: () => move(at, -1) }] : []),
    ...(at < count - 1 ? [{ label: '아래로', onPick: () => move(at, 1) }] : []),
    { label: '지우기', danger: true, onPick: () => remove(at) },
  ]
}

function Choices(props: QuestionProps) {
  const { draft, at, locked, errors, set } = props
  const multiple = draft.kind === 'multiple_choice'
  const setLabel = (order: number, label: string) =>
    set(
      { ...draft, choices: draft.choices.map((c, i) => (i === order ? { ...c, label } : c)) },
      `questions.${at}.choices.${order}.label`,
    )
  return (
    <div className={`flex flex-col ${space.choices}`}>
      {draft.choices.map((choice, order) => {
        const key = `questions.${at}.choices.${order}.label`
        return (
          <div key={choice.key} className="flex flex-col gap-1">
            <div className={`flex items-center gap-3 pr-1 pl-4 ${FILLED_BOX}`}>
              <Mark multiple={multiple} />
              <input
                aria-label={`${at + 1}번 질문 선택지 ${order + 1}`}
                aria-invalid={errors[key] ? true : undefined}
                aria-describedby={errors[key] ? `${key}-error` : undefined}
                readOnly={locked}
                value={choice.label}
                onChange={event => setLabel(order, event.target.value)}
                className={`min-h-11 min-w-0 flex-1 ${type.choice} text-fg-body ${INLINE} hover:bg-muted-strong focus:bg-white`}
              />
              {!locked && draft.choices.length > 1 && (
                <button
                  type="button"
                  aria-label={`선택지 ${order + 1} 지우기`}
                  onClick={() =>
                    set({ ...draft, choices: draft.choices.filter((_, i) => i !== order) })
                  }
                  className={`inline-flex ${size.iconHit} shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-muted hover:bg-muted-strong`}
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </div>
            <ErrorLine id={`${key}-error`} error={errors[key]} />
          </div>
        )
      })}
      {!locked && (
        <span className="-ml-2">
          <TextAction
            icon={Plus}
            onClick={() =>
              set({ ...draft, choices: [...draft.choices, newChoice(draft.choices.length + 1)] })
            }
          >
            선택지 추가
          </TextAction>
        </span>
      )}
    </div>
  )
}

function Question(props: QuestionProps) {
  const { draft, at, locked, errors, set } = props
  const key = `questions.${at}.title`
  return (
    <div className="group flex flex-col gap-2">
      <div className="flex items-start gap-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center">
          <input
            aria-label={`${at + 1}번 질문`}
            aria-invalid={errors[key] ? true : undefined}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
            readOnly={locked}
            value={draft.title}
            onChange={event => set({ ...draft, title: event.target.value }, key)}
            className={`${size.row} max-w-full min-w-12 field-sizing-content ${QUESTION_TEXT} ${INLINE}`}
          />
          <span className="-ml-2">
            <Star required={draft.required} />
          </span>
        </div>
        {!locked && (
          <div className="opacity-50 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
            <MoreMenu label={`${at + 1}번 질문 설정`} items={menuOf(props)} />
          </div>
        )}
      </div>
      <ErrorLine id={`${key}-error`} error={errors[key]} />
      {draft.kind === 'short_text' ? (
        <div aria-hidden="true" className={FILLED_BOX} />
      ) : (
        <Choices {...props} />
      )}
    </div>
  )
}

function AddQuestion({ onAdd }: { onAdd: (kind: QuestionKind) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="-ml-2 flex flex-wrap items-center gap-1">
      <TextAction icon={Plus} onClick={() => setOpen(value => !value)}>
        질문 추가
      </TextAction>
      {open &&
        KINDS.map(kind => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              onAdd(kind)
              setOpen(false)
            }}
            className={`inline-flex ${size.hit} cursor-pointer items-center rounded-full bg-surface-muted px-3 ${type.body} text-fg-secondary hover:bg-muted-strong pointer-coarse:px-4`}
          >
            {KIND_NAMES[kind]}
          </button>
        ))}
    </div>
  )
}

export function CollectSection({
  values,
  locked,
  errors,
  onChange,
}: {
  values: FormValues
  locked: boolean
  errors: FieldErrors
  onChange: Change
}) {
  const { questions } = values
  const setQuestions = (next: QuestionDraft[], key?: string) => onChange({ questions: next }, key)
  const set = (at: number) => (draft: QuestionDraft, key?: string) =>
    setQuestions(
      questions.map((q, i) => (i === at ? draft : q)),
      key,
    )
  const move = (at: number, by: number) => {
    const next = [...questions]
    const [picked] = next.splice(at, 1)
    next.splice(at + by, 0, picked!)
    setQuestions(next)
  }
  const remove = (at: number) => setQuestions(questions.filter((_, i) => i !== at))
  return (
    <section aria-labelledby="v2-collect" className={`flex flex-col ${space.blocks}`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 id="v2-collect" className={`${type.small} font-semibold text-fg-muted`}>
            받는 항목
          </h2>
          <div aria-hidden="true" className="h-px flex-1 bg-border-default" />
        </div>
        {locked && <LockNote>신청이 있어 항목은 바꿀 수 없어요</LockNote>}
      </div>
      <Basics values={values} locked={locked} onChange={onChange} />
      {questions.map((draft, at) => (
        <Question
          key={draft.key}
          draft={draft}
          at={at}
          count={questions.length}
          locked={locked}
          errors={errors}
          set={set(at)}
          move={move}
          remove={remove}
        />
      ))}
      {!locked && <AddQuestion onAdd={kind => setQuestions([...questions, newDraft(kind)])} />}
    </section>
  )
}
