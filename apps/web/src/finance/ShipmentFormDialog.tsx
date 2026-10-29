import { useState } from 'react'
import {
  ShipmentSchema,
  SHIPMENT_CARRIERS,
  SHIPMENT_CARRIER_LABELS,
  type PurchaseRequestDetail,
  type PurchaseShipment,
  type ShipmentInput,
} from '@vada/contracts'
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
import { NativeSelect } from '@/components/ui/native-select'
import { useFormCheck, type FieldErrors } from '@/lib/use-form-check'
import { approvedItems, initialShipment, shipmentErrors } from './shipment-form'

type Props = {
  request: PurchaseRequestDetail
  shipment?: PurchaseShipment | undefined
  busy: boolean
  problem: string | null
  onClose: () => void
  onSave: (values: ShipmentInput) => void
}
type FieldsProps = Pick<Props, 'request' | 'busy'> & {
  values: ShipmentInput
  onChange: (values: ShipmentInput) => void
  errors: FieldErrors
}

function ShipmentFields({ request, busy, values, onChange, errors }: FieldsProps) {
  const toggle = (id: string, checked: boolean) =>
    onChange({
      ...values,
      lineItemIds: checked
        ? [...values.lineItemIds, id]
        : values.lineItemIds.filter(item => item !== id),
    })
  return (
    <>
      <Field label="택배사" required error={errors.carrierId}>
        <NativeSelect
          value={values.carrierId}
          disabled={busy}
          onChange={event =>
            onChange({ ...values, carrierId: event.target.value as ShipmentInput['carrierId'] })
          }
        >
          {SHIPMENT_CARRIERS.map(carrier => (
            <option key={carrier} value={carrier}>
              {SHIPMENT_CARRIER_LABELS[carrier]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="송장 번호" required error={errors.trackingNumber}>
        <Input
          value={values.trackingNumber}
          inputMode="numeric"
          autoComplete="off"
          disabled={busy}
          onChange={event => onChange({ ...values, trackingNumber: event.target.value })}
        />
      </Field>
      <Field label="품목" required error={errors.lineItemIds}>
        <div tabIndex={-1} className="flex flex-col gap-2">
          {approvedItems(request).map(item => (
            <label key={item.id} className="flex items-start gap-2 text-sm wrap-anywhere">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary-emphasis"
                checked={values.lineItemIds.includes(item.id)}
                disabled={busy}
                onChange={event => toggle(item.id, event.target.checked)}
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>
      </Field>
    </>
  )
}

export function ShipmentFormDialog({ request, shipment, busy, problem, onClose, onSave }: Props) {
  const [values, setValues] = useState(() => initialShipment(request, shipment))
  const { formRef, errors, attempt } = useFormCheck(() => shipmentErrors(values))
  const title = shipment ? '송장 고치기' : '송장 넣기'
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          aria-label={title}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            if (busy || !attempt()) return
            const parsed = ShipmentSchema.safeParse(values)
            if (parsed.success) onSave(parsed.data)
          }}
        >
          <ShipmentFields
            request={request}
            busy={busy}
            values={values}
            onChange={setValues}
            errors={errors}
          />
          {problem && <StateMessage kind="error">{problem}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" busy={busy} onClick={onClose}>
              닫기
            </Button>
            <Button type="submit" busy={busy}>
              {shipment ? '저장' : '넣기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
