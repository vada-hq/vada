import { useState } from 'react'
import { PURCHASE_ITEMS_MAX, type PurchaseRequestDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PurchaseDialogHandlers } from './purchase-requests'
import {
  emptyRequest,
  newItem,
  requestOf,
  type ItemValues,
  type RequestValues,
} from './request-form'
import { EventField } from './EventField'
import { RequestItemFields } from './RequestItemFields'
import { useRequestCreate } from './useRequestCreate'

type Props = Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'> & {
  councilId: string
  // 행사 화면에서 열면 그 행사로 채운다.
  eventId?: string | null
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
  onChange,
}: {
  items: ItemValues[]
  disabled: boolean
  onChange: (items: ItemValues[]) => void
}) {
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
        />
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={disabled || items.length >= PURCHASE_ITEMS_MAX}
        onClick={() => onChange([...items, newItem()])}
      >
        품목 더하기
      </Button>
    </div>
  )
}

// 필요한 때와 내용. 아래쪽 두 칸이다.
function WhenAndBody({
  values,
  disabled,
  onChange,
}: {
  values: RequestValues
  disabled: boolean
  onChange: (patch: Partial<RequestValues>) => void
}) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        필요한 때
        <Input
          type="date"
          value={values.neededBy}
          disabled={disabled}
          onChange={event => onChange({ neededBy: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        내용
        <Textarea
          value={values.body}
          disabled={disabled}
          onChange={event => onChange({ body: event.target.value })}
        />
      </Label>
    </>
  )
}

type FormProps = Omit<Props, 'open'> & { saving: boolean; setSaving: (saving: boolean) => void }

function CreateForm({ saving, setSaving, eventId, ...props }: FormProps) {
  const [values, setValues] = useState(() => emptyRequest(eventId ?? null))
  const create = useRequestCreate(props.councilId, requestOf(values), { ...props, setSaving })
  const set = (patch: Partial<typeof values>) => setValues({ ...values, ...patch })
  return (
    <form
      aria-label="구매 요청 내기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        void create.submit()
      }}
    >
      <Label className="flex flex-col gap-2">
        제목
        <Input
          value={values.title}
          disabled={saving}
          onChange={event => set({ title: event.target.value })}
        />
      </Label>
      <EventField
        councilId={props.councilId}
        value={values.eventId}
        disabled={saving}
        onChange={next => set({ eventId: next })}
        onForbidden={props.onForbidden}
      />
      <ItemList items={values.items} disabled={saving} onChange={items => set({ items })} />
      <WhenAndBody values={values} disabled={saving} onChange={set} />
      {create.problem && <StateMessage kind="error">{create.problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={props.onClose}>
          취소
        </Button>
        <Button type="submit" disabled={!create.valid || saving}>
          내기
        </Button>
      </DialogFooter>
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
      <DialogContent aria-describedby="purchase-create-description">
        <DialogHeader>
          <DialogTitle>구매 요청 내기</DialogTitle>
          <DialogDescription id="purchase-create-description">
            재정부의 휴대폰에 알림이 가요. 금액은 재정부가 결재할 때 정해요.
          </DialogDescription>
        </DialogHeader>
        <CreateForm {...props} saving={saving} setSaving={setSaving} />
      </DialogContent>
    </Dialog>
  )
}
