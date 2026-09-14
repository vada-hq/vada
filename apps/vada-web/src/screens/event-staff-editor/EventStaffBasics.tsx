import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { TextInput } from '../../components/TextInput'
import { resolveParams } from '../../spec/params'
import type { EventStaffDraftModel } from './useEventStaffDraft'
import { ASSET, NODE, SCREEN } from './spec'

/** 전체 책임자 선택과 새 부서 입력을 표시한다. */
export function EventStaffBasics({ model }: { model: EventStaffDraftModel }) {
  const { leader, newDepartment, addDepartment } = model.specs
  const leaderValue = model.values[leader.fieldKey]

  return (
    <>
      <div className="w-72">
        <Field
          htmlFor={leader.fieldKey}
          nodeId={NODE.leader}
          label={leader.label}
          required={leader.required}
          error={model.blockedKeys.includes(leader.fieldKey) ? '필수 항목입니다' : undefined}
        >
          <SearchSelect
            id={leader.fieldKey}
            placeholder={leader.placeholder}
            searchable={leader.searchable}
            disabled={leader.initiallyDisabled}
            hasError={model.blockedKeys.includes(leader.fieldKey)}
            sourceKey={leader.optionsSource.key}
            sourceParams={resolveParams(leader.optionsSource.params, {
              screenParams: model.screenParams,
            })}
            value={
              typeof leaderValue !== 'string' || leaderValue === ''
                ? null
                : {
                    value: leaderValue,
                    label: model.draft.labels[leader.fieldKey] ?? leaderValue,
                  }
            }
            onSelect={(option) =>
              model.write(
                { [leader.fieldKey]: option.value },
                { [leader.fieldKey]: option.label },
              )
            }
            chevron={
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.leaderChevron} className="size-3.5" />
            }
          />
        </Field>
      </div>

      <div className="w-96 pt-4">
        <Field
          htmlFor={newDepartment.fieldKey}
          nodeId={NODE.newDepartment}
          label={newDepartment.label}
          required={newDepartment.required}
        >
          <div className="flex items-center gap-2">
            <TextInput
              id={newDepartment.fieldKey}
              value={model.values[newDepartment.fieldKey] ?? ''}
              placeholder={newDepartment.placeholder}
              type={newDepartment.inputType}
              onChange={(next) => model.write({ [newDepartment.fieldKey]: next })}
            />
            <button
              type="button"
              data-node-id={NODE.addDepartment}
              onClick={model.pressAction(addDepartment)}
              className="flex shrink-0 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.addDepartmentIcon} className="size-3" />
              {addDepartment.label}
            </button>
          </div>
        </Field>
      </div>
    </>
  )
}
