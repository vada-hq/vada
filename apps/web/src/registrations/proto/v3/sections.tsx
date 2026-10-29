import type { ReactNode } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import { RadioGroup as RadioPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { openAccounts } from '@/finance/account-form'
import { cn } from '@/lib/utils'
import { choiceId, choiceValue } from '@/tasks/task-form-options'
import { collectsStudentId, type FormValues } from '../../registration-form'
import type { BuilderProps } from '../builder-props'
import type { EditorState, SectionState } from './editor-state'
import { IconCircle, StateMark, TinyPill } from './parts'
import { QuestionList } from './questions'

// 설정 단의 구역 줄 하나: 아이콘 원 + 굵은 구역 이름 + 회색 지금 값 + 오른쪽 상태 원. 누르면 그 줄이 단 안에서 펼쳐진다.

const MARK_LABEL: Record<SectionState, string> = {
  done: '채움',
  todo: '아직',
  required: '필수 비어 있음',
  error: '입력 필요',
  locked: '잠김',
}

function StateSide({ state }: { state: SectionState }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      {state === 'required' && <TinyPill>필수</TinyPill>}
      {state === 'error' && <TinyPill tone="danger">입력 필요</TinyPill>}
      {state === 'locked' && (
        <TinyPill>
          <Lock aria-hidden className="size-3" />
          잠김
        </TinyPill>
      )}
      <StateMark done={state === 'done' || state === 'locked'} label={MARK_LABEL[state]} />
    </span>
  )
}

export function SectionRow(props: {
  icon: ReactNode
  title: string
  summary: string
  state: SectionState
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { open, state } = props
  return (
    <div className={cn('border-b border-border-subtle', open && 'bg-surface-subtle/70')}>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        className="h-auto w-full justify-start gap-3 rounded-none px-5 py-3.5 text-left whitespace-normal hover:bg-surface-subtle"
        onClick={props.onToggle}
      >
        <IconCircle>{props.icon}</IconCircle>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-sm font-semibold text-fg">{props.title}</span>
          <span
            className={cn(
              'truncate text-xs font-normal',
              state === 'error' ? 'text-danger' : 'text-fg-tertiary',
            )}
          >
            {props.summary}
          </span>
        </span>
        <StateSide state={state} />
        <ChevronDown aria-hidden className={cn('text-fg-subtle', open && 'rotate-180')} />
      </Button>
      {open && <div className="flex flex-col gap-4 px-5 pt-1 pb-5 lg:pl-16">{props.children}</div>}
    </div>
  )
}

type TextKey = 'name' | 'opensAt' | 'closesAt' | 'capacity' | 'fee' | 'payerFee' | 'nonPayerFee'

function TextField(props: {
  s: EditorState
  label: string
  field: TextKey
  kind?: 'number' | 'moment'
  optional?: boolean
}) {
  const { s, field, kind } = props
  const typed =
    kind === 'moment'
      ? { type: 'datetime-local' }
      : kind === 'number'
        ? { inputMode: 'numeric' as const }
        : {}
  return (
    <Field
      label={props.label}
      optional={props.optional ?? false}
      required={!props.optional}
      error={s.errors[field]}
    >
      <Input
        {...typed}
        data-field={field}
        value={s.values[field]}
        onChange={e => s.setValues({ ...s.values, [field]: e.target.value })}
      />
    </Field>
  )
}

export function EventBody({ data, onEditEvent }: Pick<BuilderProps, 'data' | 'onEditEvent'>) {
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-fg-tertiary">일시</dt>
        <dd className="text-fg wrap-anywhere">{data.eventText.when}</dd>
        <dt className="text-fg-tertiary">장소</dt>
        <dd className="text-fg wrap-anywhere">{data.eventText.place}</dd>
      </dl>
      {data.event.actions.includes('event.update') && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          touch
          className="-ml-2 self-start text-primary-strong"
          onClick={() => onEditEvent('startsAt')}
        >
          행사 정보 고치기 ›
        </Button>
      )}
    </div>
  )
}

export function RecruitBody({ s }: { s: EditorState }) {
  return (
    <>
      <TextField s={s} label="양식 이름" field="name" />
      <TextField s={s} label="신청 마감" field="closesAt" kind="moment" />
      <TextField s={s} label="신청 시작" field="opensAt" kind="moment" optional />
      <TextField s={s} label="정원" field="capacity" kind="number" optional />
      <Field label="안내" optional error={s.errors.notice}>
        <Textarea
          rows={3}
          value={s.values.notice}
          onChange={e => s.setValues({ ...s.values, notice: e.target.value })}
        />
      </Field>
    </>
  )
}

// 참가비 없음/있음: 두 칸 고르기 카드(누르는 자리 44px 이상).
function FeeChoice({ s }: { s: EditorState }) {
  const charged = s.values.feeKind !== 'none'
  return (
    <RadioPrimitive.Root
      aria-label="참가비"
      className="grid grid-cols-2 gap-2"
      value={charged ? 'one' : 'none'}
      onValueChange={kind => s.setValues({ ...s.values, feeKind: kind as FormValues['feeKind'] })}
    >
      {(['none', 'one'] as const).map(kind => {
        const on = kind === 'none' ? !charged : charged
        return (
          <Label
            key={kind}
            htmlFor={`v3-fee-${kind}`}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium',
              on ? 'border-primary-border-selected text-fg' : 'border-default text-fg-secondary',
            )}
          >
            <RadioGroupItem id={`v3-fee-${kind}`} value={kind} />
            {kind === 'none' ? '없음' : '있음'}
          </Label>
        )
      })}
    </RadioPrimitive.Root>
  )
}

export function FeeBody({ s }: { s: EditorState }) {
  const { values } = s
  return (
    <>
      <FeeChoice s={s} />
      {values.feeKind !== 'none' && (
        <>
          <Label className="flex items-center gap-2 font-normal max-sm:min-h-11">
            <input
              type="checkbox"
              className="size-4 accent-primary-emphasis"
              checked={values.feeKind === 'split'}
              onChange={e =>
                s.setValues({ ...values, feeKind: e.target.checked ? 'split' : 'one' })
              }
            />
            학생회비 납부자 별도 금액
          </Label>
          {values.feeKind === 'one' && (
            <TextField s={s} label="참가비(원)" field="fee" kind="number" />
          )}
          {values.feeKind === 'split' && (
            <>
              <TextField s={s} label="납부자 참가비(원)" field="payerFee" kind="number" />
              <TextField s={s} label="미납자 참가비(원)" field="nonPayerFee" kind="number" />
            </>
          )}
          <Field label="참가비 받을 계좌" required error={s.errors.account}>
            <NativeSelect
              data-field="account"
              value={choiceValue(s.accountId)}
              onChange={e => s.setChosen(choiceId(e.target.value))}
            >
              <option value={choiceValue(null)}>계좌 선택</option>
              {openAccounts(s.editor.accounts).map(item => (
                <option key={item.id} value={item.id}>
                  {`${item.name} (${item.bank})`}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </>
      )}
    </>
  )
}

function CheckRow(props: {
  label: string
  checked: boolean
  locked?: boolean
  onChange?: (checked: boolean) => void
}) {
  return (
    <Label
      className={cn(
        'flex min-h-11 items-center gap-3 px-3 text-sm font-normal text-fg',
        props.locked && 'text-fg-tertiary',
      )}
    >
      <input
        type="checkbox"
        className="size-4 accent-primary-emphasis"
        checked={props.checked}
        disabled={props.locked}
        onChange={e => props.onChange?.(e.target.checked)}
      />
      <span className="grow">{props.label}</span>
      {props.locked && <Lock aria-label="바꿀 수 없음" className="size-3.5 text-fg-muted" />}
    </Label>
  )
}

export function ItemsBody({ s }: { s: EditorState }) {
  const { values, editor } = s
  const locked = editor.locked
  return (
    <>
      {locked && (
        <p className="flex items-center gap-2 text-xs text-fg-tertiary">
          <Lock aria-hidden className="size-3.5" />
          신청이 있어 항목은 바꿀 수 없어요
        </p>
      )}
      <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-default bg-white">
        <CheckRow label="이름" checked locked />
        <CheckRow
          label="학번"
          checked={collectsStudentId(values)}
          locked={locked || values.feeKind === 'split'}
          onChange={checked => s.setValues({ ...values, collectsStudentId: checked })}
        />
        <CheckRow
          label="휴대폰 번호"
          checked={values.collectsPhone}
          locked={locked}
          onChange={checked => s.setValues({ ...values, collectsPhone: checked })}
        />
      </div>
      {!(locked && values.questions.length === 0) && (
        <QuestionList
          questions={values.questions}
          locked={locked}
          errors={s.errors}
          onChange={questions => s.setValues({ ...values, questions })}
        />
      )}
    </>
  )
}
