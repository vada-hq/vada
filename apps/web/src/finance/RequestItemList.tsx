import { useState } from 'react'
import { PURCHASE_ITEMS_MAX } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import type { FieldErrors } from '@/lib/use-form-check'
import { newItem, type ItemValues } from './request-form'
import { RequestItemFields } from './RequestItemFields'

const itemErrors = (errors: FieldErrors, index: number) => ({
  name: errors[`items.${index}.name`],
  quantity: errors[`items.${index}.quantity`],
  link: errors[`items.${index}.link`],
  options: errors[`items.${index}.options`],
  estimatedUnitPrice: errors[`items.${index}.estimatedUnitPrice`],
  estimatedShippingFee: errors[`items.${index}.estimatedShippingFee`],
})

export function RequestItemList({
  councilId,
  items,
  disabled,
  errors,
  onChange,
}: {
  councilId: string
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
          councilId={councilId}
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
            if (!atMax) onChange([newItem(), ...items])
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
