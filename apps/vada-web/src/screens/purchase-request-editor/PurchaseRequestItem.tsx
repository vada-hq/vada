import { ChoiceGroup } from '../../components/ChoiceGroup'
import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { TextInput } from '../../components/TextInput'
import { computeNumber, formatComputed, itemKey } from '../../spec/compute'
import { resolveParams } from '../../spec/params'
import type { GroupSpec, InputSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { ASSET, ITEM_NODE, SCREEN } from './spec'
import type { PurchaseRequestDraftModel } from './usePurchaseRequestDraft'

/** 반복되는 구매 품목 한 건의 기본값, 가격, 상세정보를 표시한다. */
export function PurchaseRequestItem({
  model,
  rowId,
  index,
}: {
  model: PurchaseRequestDraftModel
  rowId: string
  index: number
}) {
  const first = index === 0
  const nodeOf = (key: keyof typeof ITEM_NODE) => (first ? ITEM_NODE[key] : undefined)
  const valueKey = (fieldKey: string) => itemKey(model.specs.list.fieldKey, rowId, fieldKey)

  const input = (fieldKey: keyof typeof ITEM_NODE) => {
    const spec = model.itemField(fieldKey) as InputSpec
    const id = `${model.specs.list.fieldKey}-${rowId}-${spec.fieldKey}`
    return (
      <Field
        key={spec.fieldKey}
        htmlFor={id}
        nodeId={nodeOf(fieldKey)}
        label={spec.label}
        required={spec.required}
      >
        <TextInput
          id={id}
          value={model.draft.values[valueKey(spec.fieldKey)] ?? ''}
          placeholder={spec.placeholder}
          type={spec.inputType}
          onChange={(next) => model.setValue(valueKey(spec.fieldKey), next)}
        />
      </Field>
    )
  }

  const select = (fieldKey: keyof typeof ITEM_NODE, chevron: string) => {
    const spec = model.itemField(fieldKey) as SelectSpec
    const id = `${model.specs.list.fieldKey}-${rowId}-${spec.fieldKey}`
    const stored = model.draft.values[valueKey(spec.fieldKey)] ?? ''
    return (
      <Field
        key={spec.fieldKey}
        htmlFor={id}
        nodeId={nodeOf(fieldKey)}
        label={spec.label}
        required={spec.required}
      >
        <SearchSelect
          id={id}
          placeholder={spec.placeholder}
          searchable={spec.searchable}
          disabled={false}
          sourceKey={spec.optionsSource.key}
          sourceParams={resolveParams(spec.optionsSource.params, {
            screenParams: model.screenParams,
          })}
          value={
            stored === ''
              ? null
              : {
                  value: stored,
                  label: model.draft.labels[valueKey(spec.fieldKey)] ?? stored,
                }
          }
          onSelect={(option) =>
            model.setValue(valueKey(spec.fieldKey), option.value, option.label)
          }
          chevron={<FigmaAsset screenId={SCREEN} nodeId={chevron} className="size-4" />}
        />
      </Field>
    )
  }

  const totalSpec = model.itemFields.find((entry) => entry.spec.type === 'summary')!
    .spec as SummarySpec
  const totalItem = totalSpec.items![0]
  const detailGroup = model.itemFields.find((entry) => entry.spec.type === 'group')!
    .spec as GroupSpec
  const quoteSpec = model.itemField('quoteStatus') as SelectSpec
  const quoteKey = valueKey(quoteSpec.fieldKey)
  const quoteValue = model.draft.values[quoteKey] ?? quoteSpec.initialValue ?? ''
  const titleValue = model.draft.values[valueKey(model.specs.list.itemTitleFieldKey!)] ?? ''

  return (
    <div
      data-node-id={first ? ITEM_NODE.root : undefined}
      className="rounded-xl border border-gray-200 bg-white"
    >
      <div className="flex items-center gap-2 rounded-t-xl border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <span className="flex size-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-500">
          {index + 1}
        </span>
        <span className="text-xs font-bold text-gray-600">{titleValue}</span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-3 gap-4">
          {input('itemName')}
          {select('itemCategory', ASSET.itemCategoryChevron)}
          {select('budgetItem', ASSET.budgetItemChevron)}
        </div>
        <div className="flex items-end gap-4">
          <div className="w-40 shrink-0">{select('purchaseType', ASSET.purchaseTypeChevron)}</div>
          <div className="w-24 shrink-0">{input('quantity')}</div>
          <div className="w-24 shrink-0">{input('unit')}</div>
          <div className="w-32 shrink-0">{input('unitPrice')}</div>
          <div
            data-node-id={nodeOf('total')}
            className="flex flex-1 flex-col rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5"
          >
            <span className="text-[10px] font-semibold text-blue-500">{totalItem.label}</span>
            <span className="text-sm font-bold text-blue-700">
              {formatComputed(
                computeNumber(totalItem.compute!, {
                  draft: model.draft,
                  inList: { listFieldKey: model.specs.list.fieldKey, rowId },
                }),
              )}
              {totalItem.unit}
            </span>
          </div>
        </div>

        <div
          data-node-id={nodeOf('detailGroup')}
          className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4"
        >
          <p className="text-[10px] font-bold text-gray-400">{detailGroup.title}</p>
          <div className="grid grid-cols-4 gap-4">
            {input('vendor')}
            {input('productUrl')}
            {input('option')}
            {input('deliveryNote')}
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <Field
              htmlFor={`${model.specs.list.fieldKey}-${rowId}-${quoteSpec.fieldKey}`}
              nodeId={nodeOf('quoteStatus')}
              label={quoteSpec.label}
              required={quoteSpec.required}
            >
              <ChoiceGroup
                id={`${model.specs.list.fieldKey}-${rowId}-${quoteSpec.fieldKey}`}
                labelledBy={`${model.specs.list.fieldKey}-${rowId}-${quoteSpec.fieldKey}-label`}
                disabled={false}
                sourceKey={quoteSpec.optionsSource.key}
                sourceParams={{}}
                value={
                  quoteValue === ''
                    ? null
                    : {
                        value: quoteValue,
                        label: model.draft.labels[quoteKey] ?? quoteValue,
                      }
                }
                onSelect={(option) => model.setValue(quoteKey, option.value, option.label)}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}
