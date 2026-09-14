import type { ReactNode } from 'react'
import { Field } from '../../components/Field'
import { TextInput } from '../../components/TextInput'
import { CHOICE_CHIP } from '../../design/tones'
import { getOptionSource } from '../../option-sources/definitions'
import type { Option } from '../../option-sources/definitions'
import type { InputSpec } from '../../spec/types'
import { AUTO_HINT } from './spec'
import type { EventBasicsDraftModel } from './useEventBasicsDraft'

interface ModelProps {
  model: EventBasicsDraftModel
}

export function TextField({ model, nodeId }: ModelProps & { nodeId: string }) {
  const spec = model.specs.inputAt(nodeId)
  return (
    <Field
      htmlFor={spec.fieldKey}
      nodeId={nodeId}
      label={spec.labelHidden === true ? undefined : spec.label}
      required={spec.required}
      error={model.field.errors[spec.fieldKey]}
    >
      {spec.helperText === undefined ? null : <span className={AUTO_HINT}>{spec.helperText}</span>}
      {spec.multiline === true ? (
        <textarea
          id={spec.fieldKey}
          ref={model.field.registerRef(spec.fieldKey)}
          rows={3}
          value={model.valueOf(spec.fieldKey)}
          placeholder={spec.placeholder ?? undefined}
          onChange={(event) => model.setValue(spec.fieldKey, event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
        />
      ) : (
        <TextInput
          id={spec.fieldKey}
          value={model.valueOf(spec.fieldKey)}
          placeholder={spec.placeholder}
          type={spec.inputType}
          inputRef={model.field.registerRef(spec.fieldKey)}
          onChange={(next) => model.setValue(spec.fieldKey, next)}
        />
      )}
      {spec.labelHidden !== true ? null : (
        <label htmlFor={spec.fieldKey} className="sr-only">
          {spec.label}
        </label>
      )}
    </Field>
  )
}

export function DateTimeInput({ model, spec }: ModelProps & { spec: InputSpec }) {
  return (
    <input
      id={spec.fieldKey}
      type={spec.inputType}
      value={model.valueOf(spec.fieldKey)}
      onChange={(event) => model.setValue(spec.fieldKey, event.target.value)}
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
    />
  )
}

export function CheckField({ model, nodeId }: ModelProps & { nodeId: string }) {
  const spec = model.specs.inputAt(nodeId)
  return (
    <label
      data-node-id={nodeId}
      htmlFor={spec.fieldKey}
      className="flex items-center gap-1.5 text-xs font-medium text-gray-500"
    >
      <input
        id={spec.fieldKey}
        type={spec.inputType}
        value=""
        checked={model.valueOf(spec.fieldKey) === 'y'}
        onChange={(event) =>
          model.field.setFieldValue(spec.fieldKey, event.target.checked ? 'y' : null)
        }
        className="size-3.5 shrink-0 accent-blue-600"
      />
      <span>{spec.label}</span>
    </label>
  )
}

export function ChoiceField({
  model,
  nodeId,
  children,
}: ModelProps & { nodeId: string; children?: ReactNode }) {
  const spec = model.specs.selectAt(nodeId)
  const source = getOptionSource(spec.optionsSource.key)
  const options: Option[] = source.type === 'static' ? source.options : []
  const chosen = model.draft.values[spec.fieldKey] ?? null
  return (
    <div data-node-id={nodeId} className="flex flex-col gap-1.5">
      <label
        id={`${spec.fieldKey}-label`}
        htmlFor={spec.fieldKey}
        className="text-xs font-medium text-gray-700"
      >
        <span>{spec.label}</span>
        {spec.required && <span className="text-red-500">*</span>}
      </label>
      {spec.helperText === undefined ? null : <span className={AUTO_HINT}>{spec.helperText}</span>}
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
              data-design-state={chosen === null ? '' : undefined}
              onClick={() => model.field.setFieldValue(spec.fieldKey, option.value, option.label)}
              className={`rounded border px-3 py-1.5 text-xs font-medium ${
                selected ? CHOICE_CHIP.on : CHOICE_CHIP.off
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {children}
    </div>
  )
}

export function Section({
  model,
  nodeId,
  titleClass,
  children,
}: ModelProps & { nodeId: string; titleClass: string; children: ReactNode }) {
  const group = model.specs.groupAt(nodeId)
  const titleId = `${nodeId}-title`
  return (
    <section data-node-id={nodeId} aria-labelledby={titleId} className="flex flex-col gap-3">
      <span className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className={titleClass}>
          {group.title}
        </h3>
        {group.description === undefined ? null : (
          <span className="text-xs text-blue-500">{group.description}</span>
        )}
      </span>
      {children}
    </section>
  )
}
