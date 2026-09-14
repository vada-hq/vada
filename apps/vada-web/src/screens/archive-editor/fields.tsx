import type { ReactNode } from 'react'
import { SearchSelect } from '../../components/SearchSelect'
import type { DataRow } from '../../data-sources/definitions'
import { scalarValue as scalar } from '../../data-sources/values'
import type { InputSpec, SelectSpec } from '../../spec/types'
import type { ArchiveEditorModel } from './useArchiveEditor'

export function ReviewCommentBox({
  load,
  field,
  emptyNote,
}: {
  load: () => DataRow
  field: string | undefined
  emptyNote: string
}) {
  const comment = scalar(load(), field)
  return (
    <p className="min-h-24 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
      {comment === '' ? emptyNote : comment}
    </p>
  )
}

export function ArchiveTextArea({
  spec,
  valueOf,
  setValue,
}: {
  spec: InputSpec
  valueOf: (fieldKey: string) => string
  setValue: (fieldKey: string, next: string) => void
}) {
  return (
    <textarea
      id={spec.fieldKey}
      aria-label={spec.labelHidden === true ? spec.label : undefined}
      rows={4}
      value={valueOf(spec.fieldKey)}
      placeholder={spec.placeholder ?? undefined}
      onChange={(event) => setValue(spec.fieldKey, event.target.value)}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-900 focus:outline-none"
    />
  )
}

export function ArchiveDropdown({
  spec,
  field,
}: {
  spec: SelectSpec
  field: ArchiveEditorModel['field']
}) {
  return (
    <SearchSelect
      id={spec.fieldKey}
      placeholder={spec.placeholder}
      searchable={spec.searchable}
      disabled={spec.initiallyDisabled}
      sourceKey={spec.optionsSource.key}
      sourceParams={field.resolveSourceParams(spec)}
      value={field.selectValue(spec.fieldKey)}
      onSelect={(option) => field.setFieldValue(spec.fieldKey, option.value, option.label)}
    />
  )
}

export function FormSection({
  nodeId,
  title,
  description,
  labelFor,
  current,
  children,
}: {
  nodeId: string
  title: string | undefined
  description?: string
  labelFor?: string
  current: boolean
  children: ReactNode
}) {
  return (
    <section
      data-node-id={nodeId}
      aria-label={title}
      className={`overflow-hidden rounded-xl border bg-white ${
        current ? 'border-blue-300' : 'border-gray-200'
      }`}
    >
      <header className="border-b border-gray-100 bg-gray-50 px-6 py-3">
        {labelFor === undefined ? (
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        ) : (
          <label htmlFor={labelFor} className="block text-sm font-bold text-gray-900">
            {title}
          </label>
        )}
        {description === undefined ? null : (
          <p className="pt-0.5 text-xs text-gray-400">{description}</p>
        )}
      </header>
      {children}
    </section>
  )
}
