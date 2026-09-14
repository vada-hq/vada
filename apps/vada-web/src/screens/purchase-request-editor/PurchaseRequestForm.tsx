import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { TextInput } from '../../components/TextInput'
import { computeNumber, formatComputed } from '../../spec/compute'
import type { InputSpec, SelectSpec } from '../../spec/types'
import { PurchaseRequestItem } from './PurchaseRequestItem'
import { ASSET, NODE, SCREEN } from './spec'
import type { PurchaseRequestDraftModel } from './usePurchaseRequestDraft'

/** 요청 기본정보와 반복 품목 목록을 표시한다. */
export function PurchaseRequestForm({ model }: { model: PurchaseRequestDraftModel }) {
  const { heading, baseGroup, count, list, screenField } = model.specs
  const countItem = count.items![0]
  const inputField = (nodeId: string, readOnly = false) => {
    const spec = screenField(nodeId) as InputSpec
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
          readOnly={readOnly}
          onChange={(next) => model.setValue(spec.fieldKey, next)}
        />
      </Field>
    )
  }
  const priority = screenField(NODE.priority) as SelectSpec
  const priorityValue = model.draft.values[priority.fieldKey] ?? ''

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div data-node-id={NODE.heading}>
        <h2 className="text-lg font-bold text-gray-900">{heading.title}</h2>
        <p className="pt-1 text-xs text-gray-500">{heading.description}</p>
      </div>

      <section
        data-node-id={NODE.baseGroup}
        aria-label={baseGroup.title}
        className="rounded-xl border border-gray-200 bg-white p-5"
      >
        <p className="flex items-center gap-2 pb-4 text-sm font-bold text-gray-800">
          <span className="h-4 w-1 rounded bg-blue-600" />
          {baseGroup.title}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {inputField(NODE.title)}
          {inputField(NODE.department, true)}
          {inputField(NODE.neededOn)}
          <Field
            htmlFor={priority.fieldKey}
            nodeId={NODE.priority}
            label={priority.label}
            required={priority.required}
          >
            <SearchSelect
              id={priority.fieldKey}
              placeholder={priority.placeholder}
              searchable={priority.searchable}
              disabled={false}
              sourceKey={priority.optionsSource.key}
              sourceParams={{}}
              value={
                priorityValue === ''
                  ? null
                  : {
                      value: priorityValue,
                      label: model.draft.labels[priority.fieldKey] ?? priorityValue,
                    }
              }
              onSelect={(option) =>
                model.setValue(priority.fieldKey, option.value, option.label)
              }
              chevron={<FigmaAsset screenId={SCREEN} nodeId={ASSET.priorityChevron} className="size-4" />}
            />
          </Field>
        </div>
        <div className="pt-4">{inputField(NODE.purpose)}</div>
      </section>

      <section data-node-id={NODE.items} aria-label={list.label}>
        <div className="flex items-center justify-between gap-4 pb-3">
          <p className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <span className="h-4 w-1 rounded bg-blue-600" />
            <span>{list.label}</span>
            <span data-node-id={NODE.itemCount} className="text-xs font-normal text-gray-400">
              {countItem.label}{' '}
              {formatComputed(computeNumber(countItem.compute!, { draft: model.draft }))}
              {countItem.unit}
            </span>
          </p>
          <button
            type="button"
            onClick={model.addItem}
            disabled={model.rowIds.length >= list.maxItems}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-400"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.addItem} className="size-3" />
            {list.addLabel}
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {model.rowIds.map((rowId, index) => (
            <PurchaseRequestItem key={rowId} model={model} rowId={rowId} index={index} />
          ))}
        </div>
      </section>
    </div>
  )
}
