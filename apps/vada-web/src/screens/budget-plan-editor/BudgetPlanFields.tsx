import type { ReactNode } from 'react'
import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { TextInput } from '../../components/TextInput'
import { itemKey } from '../../spec/compute'
import type { InputSpec, ListSpec, SelectSpec } from '../../spec/types'
import { ASSET, ITEM_NODE, SCREEN, itemFieldOf } from './spec'
import type { BudgetPlanDraftModel } from './useBudgetPlanDraft'

export function ScreenInput({ model, nodeId }: { model: BudgetPlanDraftModel; nodeId: string }) {
  const spec = model.specs.inputAt(nodeId)
  return (
    <Field
      htmlFor={spec.fieldKey}
      nodeId={nodeId}
      label={spec.label}
      required={spec.required}
      helperText={spec.helperText}
    >
      <TextInput
        id={spec.fieldKey}
        value={model.draft.values[spec.fieldKey] ?? ''}
        placeholder={spec.placeholder}
        type={spec.inputType}
        onChange={(next) => model.setValue(spec.fieldKey, next)}
      />
    </Field>
  )
}

export function RowInput({
  model,
  list,
  rowId,
  fieldKey,
  first,
}: {
  model: BudgetPlanDraftModel
  list: ListSpec
  rowId: string
  fieldKey: keyof typeof ITEM_NODE
  first: boolean
}) {
  const spec = itemFieldOf(list, fieldKey) as InputSpec
  const key = itemKey(list.fieldKey, rowId, fieldKey)
  const id = `${list.fieldKey}-${rowId}-${fieldKey}`
  return (
    <Field
      htmlFor={id}
      nodeId={first ? ITEM_NODE[fieldKey] : undefined}
      label={spec.label}
      required={spec.required}
    >
      <TextInput
        id={id}
        value={model.draft.values[key] ?? ''}
        placeholder={spec.placeholder}
        type={spec.inputType}
        onChange={(next) => model.setValue(key, next)}
      />
    </Field>
  )
}

export function DepartmentCell({
  model,
  list,
  rowId,
  spec,
  nodeId,
}: {
  model: BudgetPlanDraftModel
  list: ListSpec
  rowId: string
  spec: SelectSpec
  nodeId: string | undefined
}) {
  const key = itemKey(list.fieldKey, rowId, spec.fieldKey)
  const id = `${list.fieldKey}-${rowId}-${spec.fieldKey}`
  const stored = model.draft.values[key] ?? ''
  return (
    <div className="w-64 shrink-0">
      <Field htmlFor={id} nodeId={nodeId} label={spec.label} required={spec.required}>
        <SearchSelect
          id={id}
          placeholder={spec.placeholder}
          searchable={spec.searchable}
          disabled={false}
          sourceKey={spec.optionsSource.key}
          sourceParams={{}}
          value={
            stored === ''
              ? null
              : {
                  value: stored,
                  label: model.labelOf(model.departmentOptions, key, stored),
                }
          }
          onSelect={(option) => model.setValue(key, option.value, option.label)}
          chevron={<FigmaAsset screenId={SCREEN} nodeId={ASSET.departmentChevron} className="size-4" />}
        />
      </Field>
    </div>
  )
}

export function RemoveButton({
  model,
  list,
  rowIds,
  rowId,
}: {
  model: BudgetPlanDraftModel
  list: ListSpec
  rowIds: string[]
  rowId: string
}) {
  if (!list.itemActions.includes('remove')) return null
  return (
    <button
      type="button"
      onClick={() => model.removeRow(list, rowIds, rowId)}
      className="shrink-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      지우기
    </button>
  )
}

export function AddButton({
  list,
  rowIds,
  onAdd,
  blocked = false,
}: {
  list: ListSpec
  rowIds: string[]
  onAdd: () => void
  blocked?: boolean
}): ReactNode {
  return (
    <div>
      <button
        type="button"
        onClick={onAdd}
        disabled={blocked || rowIds.length >= list.maxItems}
        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-400"
      >
        {list.addLabel}
      </button>
    </div>
  )
}
