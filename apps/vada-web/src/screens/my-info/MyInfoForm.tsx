import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { TextInput } from '../../components/TextInput'
import { nodeIdOf } from '../../spec/screens'
import { myInfo01 } from '../../spec/screen-specs/myInfo01'
import type { InputSpec, SelectSpec, SubmitAction } from '../../spec/types'
import {
  MY_INFO_CHEVRON as CHEVRON,
  MY_INFO_INPUTS as INPUTS,
  MY_INFO_SELECTS as SELECTS,
} from './config'
import type { MyInfoFormModel } from './useMyInfoForm'

function MyInfoInput({ spec, model }: { spec: InputSpec; model: MyInfoFormModel }) {
  return (
    <Field
      htmlFor={spec.fieldKey}
      nodeId={nodeIdOf(myInfo01, spec)}
      label={spec.label}
      required={spec.required}
      error={model.field.errors[spec.fieldKey]}
      helperText={spec.helperText}
    >
      <TextInput
        id={spec.fieldKey}
        value={model.draft.values[spec.fieldKey] ?? ''}
        placeholder={spec.placeholder}
        type={spec.inputType}
        readOnly={spec.readOnly}
        hasError={model.field.errors[spec.fieldKey] !== undefined}
        inputRef={model.field.registerRef(spec.fieldKey)}
        onChange={(next) =>
          spec.readOnly === true
            ? undefined
            : model.field.setFieldValue(spec.fieldKey, next === '' ? null : next)
        }
      />
    </Field>
  )
}

function MyInfoSelect({ spec, model }: { spec: SelectSpec; model: MyInfoFormModel }) {
  const disabled = !model.field.isSelectEnabled(spec)
  return (
    <Field
      htmlFor={spec.fieldKey}
      nodeId={nodeIdOf(myInfo01, spec)}
      label={spec.label}
      required={spec.required}
      disabled={disabled}
      error={model.field.errors[spec.fieldKey]}
    >
      <SearchSelect
        id={spec.fieldKey}
        placeholder={disabled ? (spec.disabledPlaceholder ?? null) : spec.placeholder}
        searchable={spec.searchable}
        disabled={disabled}
        hasError={model.field.errors[spec.fieldKey] !== undefined}
        sourceKey={spec.optionsSource.key}
        sourceParams={model.field.resolveSourceParams(spec)}
        value={model.field.selectValue(spec.fieldKey)}
        onSelect={(option) => {
          model.setSaved(false)
          model.field.setFieldValue(spec.fieldKey, option.value, option.label)
        }}
        triggerRef={model.field.registerRef(spec.fieldKey)}
        chevron={
          <FigmaAsset
            screenId={myInfo01.screenId}
            nodeId={CHEVRON[spec.fieldKey]}
            className="size-4"
          />
        }
      />
    </Field>
  )
}

export function MyInfoForm({ model }: { model: MyInfoFormModel }) {
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <section className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">학적 정보</h2>
            <p className="text-xs text-gray-400">
              이름은 로그인한 계정에서 오므로 여기서 고치지 않습니다.
            </p>
          </div>
          <button
            type="button"
            data-node-id={nodeIdOf(myInfo01, model.save)}
            onClick={model.pressSave}
            className="shrink-0 rounded-md bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {model.submitAction.labelOf(model.save.action as SubmitAction, model.save.label)}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {INPUTS.map((nodeId) => (
            <MyInfoInput key={nodeId} spec={model.inputAt(nodeId)} model={model} />
          ))}
          {SELECTS.map((nodeId) => (
            <MyInfoSelect key={nodeId} spec={model.selectAt(nodeId)} model={model} />
          ))}
        </div>

        {model.submitAction.errorMessage === null ? null : (
          <p role="alert" className="text-xs text-red-500">{model.submitAction.errorMessage}</p>
        )}
        {model.saved && model.submitAction.errorMessage === null ? (
          <p role="status" className="text-xs text-gray-500">저장했습니다.</p>
        ) : null}
      </section>

      <section
        data-node-id={nodeIdOf(myInfo01, model.belonging)}
        className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5"
      >
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{model.belonging.title}</h2>
          {model.belonging.description === undefined ? null : (
            <p className="text-xs text-gray-400">{model.belonging.description}</p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-5">
          {(model.belonging.items ?? []).map((item) => (
            <div key={item.field} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
              <span className="text-sm text-gray-800">{String(model.belongs[item.field!] ?? '')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
