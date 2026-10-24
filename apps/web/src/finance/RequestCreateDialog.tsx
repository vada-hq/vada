import { useState } from 'react'
import { PURCHASE_ITEMS_MAX, type PurchaseRequestDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { requiredText, useFormCheck, withContract, type FieldErrors } from '@/lib/use-form-check'
import type { Choice } from '@/tasks/task-form-options'
import type { PurchaseDialogHandlers } from './purchase-requests'
import {
  emptyRequest,
  newItem,
  requestOf,
  type ItemValues,
  type RequestStart,
  type RequestValues,
} from './request-form'
import { EventField } from './EventField'
import { RequesterField } from './RequesterField'
import { RequestItemFields } from './RequestItemFields'
import { useRequestCreate } from './useRequestCreate'

type Props = Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'> & {
  councilId: string
  // 행사 화면에서 열면 그 행사로 채운다.
  eventId?: string | null
  // 대화의 메시지에서 열면 그 메시지로 채운 값(제목, 내용, 요청한 사람, 근거 메시지).
  start?: RequestStart
  // 업무 상세에서 열면 그 업무(기능 015). 낸 요청이 업무에 이어진다.
  taskId?: string
  // 재정부가 대신 낼 때 고르는 요청한 사람들. 없으면 칸이 없다.
  requesters?: Choice[] | null
  // 열림 상태는 부모가 가진다([구매 요청 내기] 버튼이 연다).
  open: boolean
  onClose: () => void
  // 낸 요청을 받는다. 부모가 목록을 다시 읽고 대화상자를 닫는다.
  onCreated: (request: PurchaseRequestDetail) => void
}

// 구매 요청 내기 대화상자. 닫혀 있으면 아무것도 하지 않는다.
export function RequestCreateDialog({ open, ...props }: Props) {
  if (!open) return null
  return <OpenCreateDialog {...props} />
}

function ItemList({
  items,
  disabled,
  errors,
  onChange,
}: {
  items: ItemValues[]
  disabled: boolean
  errors: FieldErrors
  onChange: (items: ItemValues[]) => void
}) {
  // 상한에서도 버튼은 켜 두고, 누르면 옆에 이유를 보인다.
  const [pressedAtMax, setPressedAtMax] = useState(false)
  const atMax = items.length >= PURCHASE_ITEMS_MAX
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <RequestItemFields
          key={item.key}
          index={index}
          values={item}
          disabled={disabled}
          removable={items.length > 1}
          onChange={next => onChange(items.map(it => (it.key === item.key ? next : it)))}
          onRemove={() => onChange(items.filter(it => it.key !== item.key))}
          errors={itemErrors(errors, index)}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          busy={disabled}
          onClick={() => {
            setPressedAtMax(atMax)
            if (!atMax) onChange([...items, newItem()])
          }}
        >
          품목 더하기
        </Button>
        {atMax && pressedAtMax && (
          <p role="alert" className="text-xs text-red-600">
            {`품목은 ${PURCHASE_ITEMS_MAX}개까지 더할 수 있어요`}
          </p>
        )}
      </div>
    </div>
  )
}

const DIGITS = /^[0-9]+$/

// 제목과 품목마다 이름·수량이 필수다. 수량은 1 이상의 정수(계약과 같은 규칙).
function requestErrors(values: RequestValues) {
  const items = values.items.flatMap((item, index) => {
    const quantity = item.quantity.trim()
    return [
      [`items.${index}.name`, requiredText(item.name, '이름을')],
      [
        `items.${index}.quantity`,
        requiredText(quantity, '수량을') ??
          (DIGITS.test(quantity) && Number(quantity) > 0
            ? undefined
            : '1 이상의 숫자를 입력해 주세요'),
      ],
    ] as const
  })
  return { title: requiredText(values.title, '제목을'), ...Object.fromEntries(items) }
}

// 한 줄의 문제만 골라 그 줄에 넘긴다.
const itemErrors = (errors: FieldErrors, index: number) => ({
  name: errors[`items.${index}.name`],
  quantity: errors[`items.${index}.quantity`],
  link: errors[`items.${index}.link`],
  options: errors[`items.${index}.options`],
})

// 계약이 막은 형식 문제 가운데 칸 이름만으로는 알기 어려운 것
const CONTRACT_MESSAGES = { link: 'http:// 또는 https://로 시작하는 주소를 입력해 주세요' }

// 필요한 때와 내용. 아래쪽 두 칸이다.
function WhenAndBody({
  values,
  disabled,
  error,
  onChange,
}: {
  values: RequestValues
  disabled: boolean
  // 내용 칸의 문제
  error: string | undefined
  onChange: (patch: Partial<RequestValues>) => void
}) {
  return (
    <>
      <Field label="필요한 때" optional>
        <Input
          type="date"
          value={values.neededBy}
          disabled={disabled}
          onChange={event => onChange({ neededBy: event.target.value })}
        />
      </Field>
      <Field label="내용" optional error={error}>
        <Textarea
          value={values.body}
          disabled={disabled}
          onChange={event => onChange({ body: event.target.value })}
        />
      </Field>
    </>
  )
}

type FormProps = Omit<Props, 'open'> & { saving: boolean; setSaving: (saving: boolean) => void }

// 오류와 [취소]·[내기]
function CreateFooter(props: { problem: string | null; saving: boolean; onClose: () => void }) {
  return (
    <>
      {props.problem && <StateMessage kind="error">{props.problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" busy={props.saving} onClick={props.onClose}>
          취소
        </Button>
        <Button type="submit" busy={props.saving}>
          내기
        </Button>
      </DialogFooter>
    </>
  )
}

function CreateForm({
  saving,
  setSaving,
  eventId,
  start,
  requesters,
  taskId,
  ...props
}: FormProps) {
  const [values, setValues] = useState(() => emptyRequest(eventId ?? null, start))
  const request = { ...requestOf(values), ...(taskId ? { taskId } : {}) }
  const create = useRequestCreate(props.councilId, request, { ...props, setSaving })
  const set = (patch: Partial<typeof values>) => setValues({ ...values, ...patch })
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() => withContract(requestErrors(values), create.parsed, CONTRACT_MESSAGES))
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="구매 요청 내기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (attempt()) void create.submit()
      }}
    >
      <Field label="제목" required error={fieldErrors.title}>
        <Input
          value={values.title}
          disabled={saving}
          onChange={event => set({ title: event.target.value })}
        />
      </Field>
      <RequesterField
        choices={requesters ?? null}
        value={values.requestedBy}
        disabled={saving}
        onChange={requestedBy => set({ requestedBy })}
      />
      <EventField
        councilId={props.councilId}
        value={values.eventId}
        disabled={saving}
        onChange={next => set({ eventId: next })}
        onForbidden={props.onForbidden}
      />
      <ItemList
        items={values.items}
        disabled={saving}
        errors={fieldErrors}
        onChange={items => set({ items })}
      />
      <WhenAndBody values={values} disabled={saving} error={fieldErrors.body} onChange={set} />
      <CreateFooter problem={create.problem} saving={saving} onClose={props.onClose} />
    </form>
  )
}

function OpenCreateDialog(props: Omit<Props, 'open'>) {
  const [saving, setSaving] = useState(false)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) props.onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>구매 요청 내기</DialogTitle>
        </DialogHeader>
        <CreateForm {...props} saving={saving} setSaving={setSaving} />
      </DialogContent>
    </Dialog>
  )
}
