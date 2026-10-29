import { Check, MoreHorizontal, Plus, X } from 'lucide-react'
import {
  QUESTION_CHOICE_MAX,
  QUESTION_KIND_LABELS,
  QUESTION_KINDS,
  type QuestionKind,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import type { FieldErrors } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'
import { ErrorLine, TextAction } from './DocParts'
import { fieldSurface, size, type } from './doc-look'
import { newChoice, withKind, type QuestionDraft } from './question-draft'

// 질문 하나 = '질문 글(그 자리에서 고침) + 별표 + 종류 이름 + •••' 한 줄과 가로로 감기는 선택지 알약.
// 학생에게 보이는 모습은 옆 미리보기가 맡는다(검토 지적 '신청 화면과 겹침'). 설정(필수·종류·차례·지우기)은 질문마다 ••• 하나.
// 신청이 있으면 질문은 바꿀 수 없다(서버도 409, DEC-93). 글은 읽기만 하고 •••·지우기·더하기가 없다.

const TITLE = `${size.row} max-w-full min-w-12 w-auto field-sizing-content -ml-2.5 px-2.5 py-1.5 font-semibold text-fg-body ${type.input} ${fieldSurface} read-only:ml-0 read-only:px-0 read-only:hover:bg-transparent read-only:focus:ring-0`
const CHOICE_TEXT = `h-auto min-h-7 max-w-60 min-w-8 w-auto field-sizing-content rounded-md px-1 py-0 ${type.input} ${fieldSurface} read-only:hover:bg-transparent read-only:focus:ring-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11`

export type QuestionProps = {
  draft: QuestionDraft
  at: number
  count: number
  locked: boolean
  errors: FieldErrors
  set: (draft: QuestionDraft) => void
  move: (at: number, by: number) => void
  remove: (at: number) => void
}

function Star({ required }: { required: boolean }) {
  return required ? (
    <span aria-hidden="true" className="text-danger-emphasis">
      *
    </span>
  ) : (
    <span className={`${type.small} text-fg-muted`}>(선택)</span>
  )
}

// 질문마다 •••: 필수 켬/끔, 종류 바꾸기, 위로·아래로, 지우기(Notion 폼).
function QuestionMenu({ draft, at, count, set, move, remove }: QuestionProps) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${at + 1}번 질문 설정`}
          className={`${size.iconHit} rounded-lg`}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => set({ ...draft, required: !draft.required })}>
          {draft.required ? '필수 끄기' : '필수 켜기'}
        </MenuItem>
        {QUESTION_KINDS.filter(kind => kind !== draft.kind).map(kind => (
          <MenuItem key={kind} onSelect={() => set(withKind(draft, kind))}>
            {QUESTION_KIND_LABELS[kind]}로 바꾸기
          </MenuItem>
        ))}
        {at > 0 && <MenuItem onSelect={() => move(at, -1)}>위로</MenuItem>}
        {at < count - 1 && <MenuItem onSelect={() => move(at, 1)}>아래로</MenuItem>}
        <MenuItem destructive onSelect={() => remove(at)}>
          지우기
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

function Mark({ kind }: { kind: QuestionKind }) {
  const multiple = kind === 'multiple_choice'
  return (
    <span
      aria-hidden="true"
      className={`flex size-4 shrink-0 items-center justify-center bg-white ring-1 ring-border-strong ring-inset ${multiple ? 'rounded' : 'rounded-full'}`}
    >
      {multiple && <Check className="size-3 text-transparent" />}
    </span>
  )
}

const choiceKey = (at: number, order: number) => `questions.${at}.choices.${order}.label`

// 선택지 = 가로로 감기는 작은 알약(모양 표시 + 고칠 수 있는 글 + ×). 끝에 [+ 선택지]. 하나는 늘 남긴다.
function Choices({ draft, at, locked, errors, set }: QuestionProps) {
  const setLabel = (order: number, label: string) =>
    set({ ...draft, choices: draft.choices.map((c, i) => (i === order ? { ...c, label } : c)) })
  const failed = draft.choices.map((_, order) => choiceKey(at, order)).filter(key => errors[key])
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {draft.choices.map((choice, order) => {
          const key = choiceKey(at, order)
          return (
            <span
              key={choice.key}
              className={cn(
                `inline-flex ${size.chip} items-center gap-1.5 rounded-lg pl-2.5 ring-1 ring-border-default ring-inset`,
                locked ? 'pr-2.5' : 'pr-0.5',
              )}
            >
              <Mark kind={draft.kind} />
              <Input
                aria-label={`${at + 1}번 질문 선택지 ${order + 1}`}
                aria-invalid={errors[key] ? true : undefined}
                aria-describedby={errors[key] ? `${key}-error` : undefined}
                readOnly={locked}
                value={choice.label}
                onChange={event => setLabel(order, event.target.value)}
                className={CHOICE_TEXT}
              />
              {!locked && draft.choices.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`선택지 ${order + 1} 지우기`}
                  onClick={() =>
                    set({ ...draft, choices: draft.choices.filter((_, i) => i !== order) })
                  }
                  className="size-7 rounded-md p-0 [&_svg]:size-3.5 pointer-coarse:size-11"
                >
                  <X aria-hidden />
                </Button>
              )}
            </span>
          )
        })}
        {!locked && draft.choices.length < QUESTION_CHOICE_MAX && (
          <TextAction
            icon={Plus}
            onClick={() =>
              set({ ...draft, choices: [...draft.choices, newChoice(draft.choices.length + 1)] })
            }
          >
            선택지
          </TextAction>
        )}
      </div>
      {failed.map(key => (
        <ErrorLine key={key} id={`${key}-error`} error={errors[key]} />
      ))}
    </div>
  )
}

export function Question(props: QuestionProps) {
  const { draft, at, locked, errors, set } = props
  const key = `questions.${at}.title`
  return (
    <div className="group flex flex-col gap-1.5">
      <div className="flex items-start gap-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1">
          <Input
            aria-label={`${at + 1}번 질문`}
            aria-invalid={errors[key] ? true : undefined}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
            readOnly={locked}
            value={draft.title}
            onChange={event => set({ ...draft, title: event.target.value })}
            className={TITLE}
          />
          <Star required={draft.required} />
          <span className={`ml-2 ${type.small} text-fg-muted`}>
            {QUESTION_KIND_LABELS[draft.kind]}
          </span>
        </div>
        {!locked && (
          <div className="opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
            <QuestionMenu {...props} />
          </div>
        )}
      </div>
      <ErrorLine id={`${key}-error`} error={errors[key]} />
      {draft.kind !== 'short_text' && <Choices {...props} />}
    </div>
  )
}
