import type { ComponentProps } from 'react'
import type { ProductInfo } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field as LabeledField } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { FieldErrors } from '@/lib/use-form-check'
import type { ItemValues } from './request-form'
import { sellerOf } from '@/lib/seller'
import { PRODUCT_NONE_REASON } from '@/lib/product-info'
import { wonLabel } from './purchase-view'
import { ProductPreview } from './ProductPreview'
import { useItemProduct } from './use-item-product'
import { RequestEstimateFields } from './RequestEstimateFields'

type Props = {
  councilId: string
  index: number
  values: ItemValues
  disabled: boolean
  // 마지막 한 줄은 뺄 수 없다.
  removable: boolean
  onChange: (values: ItemValues) => void
  onRemove: () => void
  // 이 줄의 문제(name, quantity, link, options)
  errors: FieldErrors
}

// 라벨 안의 입력칸. 줄마다 같은 이름이 되풀이되므로 보조 기술에는 '품목 1 이름'처럼 줄 번호를 붙여 알린다.
function Field({
  label,
  item,
  required = false,
  error,
  ...props
}: {
  label: string
  item: string
  required?: boolean
  error?: string | undefined
} & ComponentProps<'input'>) {
  return (
    <LabeledField label={label} required={required} optional={!required} error={error}>
      <Input aria-label={`${item} ${label}`} {...props} />
    </LabeledField>
  )
}

// 품목 한 줄: 이름, 수량, 링크, 옵션. 길이 상한은 계약이 판단하므로(safeParse) 여기에 숫자를 적지 않는다.
export function RequestItemFields({
  councilId,
  index,
  values,
  disabled,
  removable,
  onChange,
  onRemove,
  errors,
}: Props) {
  const item = `품목 ${index + 1}`
  const product = useItemProduct(councilId, values, onChange, disabled)
  const text = (field: 'name' | 'link' | 'options') => ({
    item,
    disabled,
    value: values[field],
    onChange: (event: { target: { value: string } }) =>
      onChange({
        ...values,
        [field]: event.target.value,
        ...(field === 'name' ? { nameEdited: true } : {}),
      }),
  })
  return (
    <Card role="group" aria-label={item} className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{item}</h3>
        {removable && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            busy={disabled}
            aria-label={`${item} 빼기`}
            onClick={onRemove}
          >
            빼기
          </Button>
        )}
      </div>
      <Field
        label="링크"
        inputMode="url"
        autoCapitalize="none"
        error={errors.link}
        {...text('link')}
        onChange={event => onChange(changedLink(values, event.target.value))}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void product.load()
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        busy={disabled || product.state.kind === 'loading'}
        onClick={() => void product.load()}
      >
        불러오기
      </Button>
      <ProductReadout state={product.state} product={values.loadedProduct} />
      <Field label="이름" required error={errors.name} {...text('name')} />
      <Field
        label="수량"
        required
        error={errors.quantity}
        type="number"
        inputMode="numeric"
        min={1}
        item={item}
        disabled={disabled}
        value={values.quantity}
        onChange={event => onChange({ ...values, quantity: event.target.value })}
      />
      {sellerOf(values.link) && (
        <span className="text-xs text-fg-muted">{sellerOf(values.link)}</span>
      )}
      {!values.loadedProduct && values.loadedPrice != null && (
        <span className="text-xs text-fg-muted">{`불러온 가격 ${wonLabel(values.loadedPrice)}`}</span>
      )}
      <Field label="옵션" error={errors.options} {...text('options')} />
      <RequestEstimateFields
        item={item}
        values={values}
        disabled={disabled}
        errors={errors}
        onChange={onChange}
      />
    </Card>
  )
}

function ProductReadout({
  state,
  product,
}: {
  state: ReturnType<typeof useItemProduct>['state']
  product: ProductInfo | undefined
}) {
  return (
    <>
      {state.kind === 'loading' && (
        <p role="status" className="text-xs text-fg-muted">
          상품 정보를 불러오는 중이에요.
        </p>
      )}
      {state.kind === 'none' && (
        <p role="status" className="text-xs break-keep text-muted-foreground">
          {PRODUCT_NONE_REASON[state.reason]}
          {state.reason !== 'unsupported' && ' 직접 적어 주세요.'}
        </p>
      )}
      {product && <ProductPreview product={product} />}
    </>
  )
}

function changedLink(values: ItemValues, link: string): ItemValues {
  const next = { ...values, link }
  delete next.loadedProduct
  delete next.loadedPrice
  if (!values.nameEdited) next.name = ''
  if (!values.unitPriceEdited) next.estimatedUnitPrice = ''
  if (!values.shippingFeeEdited) next.estimatedShippingFee = ''
  return next
}
