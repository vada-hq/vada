import { CHOICE_CHIP } from '../../design/tones'
import { getOptionSource, type Option } from '../../option-sources/definitions'
import type { InputSpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { inputAt, selectAt } from './survey-spec'

export interface SurveyFieldProps {
  values: ScopeDraft['values']
  onChangeValue: (fieldKey: string, value: string | null, label?: string) => void
}

export function SurveyDateTimeInput({
  spec, invalid, values, onChangeValue,
}: SurveyFieldProps & { spec: InputSpec; invalid: boolean }) {
  return (
    <input
      id={spec.fieldKey}
      type={spec.inputType}
      value={values[spec.fieldKey] ?? ''}
      onChange={(event) => onChangeValue(spec.fieldKey, event.target.value === '' ? null : event.target.value)}
      className={`w-full rounded border px-3 py-1.5 text-xs text-gray-800 ${
        invalid ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
      }`}
    />
  )
}

export function SurveyCheckField({
  nodeId, values, onChangeValue,
}: SurveyFieldProps & { nodeId: string }) {
  const spec = inputAt(nodeId)
  return (
    <label
      data-node-id={nodeId}
      htmlFor={spec.fieldKey}
      className="flex items-center gap-2 text-xs font-medium text-gray-700"
    >
      <input
        id={spec.fieldKey}
        type={spec.inputType}
        // 체크 상자의 value는 기본이 'on'이라 대조기가 그 글을 칸의 내용으로
        // 읽는다. 켜짐은 checked가 말한다.
        value=""
        checked={(values[spec.fieldKey] ?? '') === 'y'}
        onChange={(event) => onChangeValue(spec.fieldKey, event.target.checked ? 'y' : null)}
        className="size-3 shrink-0 accent-blue-600"
      />
      <span>{spec.label}</span>
    </label>
  )
}

export function SurveyChoiceField({
  nodeId, labelClass, values, onChangeValue,
}: SurveyFieldProps & { nodeId: string; labelClass: string }) {
  const spec = selectAt(nodeId)
  const source = getOptionSource(spec.optionsSource.key)
  const options: Option[] = source.type === 'static' ? source.options : []
  const chosen = values[spec.fieldKey] ?? null
  return (
    <>
      <label id={`${spec.fieldKey}-label`} htmlFor={spec.fieldKey} className={labelClass}>
        <span>{spec.label}</span>
        {spec.required && <span className="text-red-500">*</span>}
      </label>
      <div
        id={spec.fieldKey}
        role="radiogroup"
        aria-labelledby={`${spec.fieldKey}-label`}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => {
          const selected = option.value === chosen
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChangeValue(spec.fieldKey, option.value, option.label)}
              className={`rounded border px-3 py-1.5 text-xs font-medium ${
                selected ? CHOICE_CHIP.on : CHOICE_CHIP.off
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
