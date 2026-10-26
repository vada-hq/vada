import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { FieldErrors } from '@/lib/use-form-check'
import type { ItemValues } from './request-form'

export function RequestEstimateFields({
  item,
  values,
  disabled,
  errors,
  onChange,
}: {
  item: string
  values: ItemValues
  disabled: boolean
  errors: FieldErrors
  onChange: (values: ItemValues) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="예상 단가(원)" optional error={errors.estimatedUnitPrice}>
        <Input
          aria-label={`${item} 예상 단가`}
          inputMode="numeric"
          value={values.estimatedUnitPrice}
          disabled={disabled}
          onChange={event =>
            onChange({ ...values, estimatedUnitPrice: event.target.value, unitPriceEdited: true })
          }
        />
      </Field>
      <Field
        label="예상 배송비(원)"
        optional
        error={errors.estimatedShippingFee}
        hint="모르면 비워 두세요. 무료배송이 확인되면 0원을 적어요."
      >
        <Input
          aria-label={`${item} 예상 배송비`}
          inputMode="numeric"
          value={values.estimatedShippingFee}
          disabled={disabled}
          onChange={event =>
            onChange({
              ...values,
              estimatedShippingFee: event.target.value,
              shippingFeeEdited: true,
            })
          }
        />
      </Field>
    </div>
  )
}
