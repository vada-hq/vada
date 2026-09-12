import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { TextInput } from '../../components/TextInput'
import { itemKey } from '../../spec/compute'
import { resolveParams } from '../../spec/params'
import type { InputSpec, SelectSpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { ASSET, SCREEN, specOf } from './meeting-spec'

interface FieldProps {
  nodeId: string
  draft: ScopeDraft
  onChangeValue: (key: string, value: string, label?: string) => void
  row?: { rowId: string; listKey: string; first: boolean }
}

export function MeetingInputField({ nodeId, draft, onChangeValue, row }: FieldProps) {
  const valueOf = (key: string) => draft.values[key] ?? ''
  const spec = specOf(nodeId) as InputSpec
  const key =
    row === undefined
      ? spec.fieldKey
      : itemKey(row.listKey, row.rowId, spec.fieldKey)
  const id = row === undefined ? spec.fieldKey : key
  return (
    <Field
      htmlFor={id}
      nodeId={row === undefined || row.first ? nodeId : undefined}
      label={spec.label}
      required={spec.required}
      helperText={spec.helperText}
    >
      {spec.multiline === true ? (
        // 디자인이 Text Area로 그린 자리(input.multiline). 한 줄짜리로 그리면
        // '긴 글'이라는 사실이 화면에서 사라진다.
        <textarea
          id={id}
          value={valueOf(key)}
          placeholder={spec.placeholder ?? undefined}
          rows={3}
          onChange={(event) => onChangeValue(key, event.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
        />
      ) : (
        <TextInput
          id={id}
          value={valueOf(key)}
          placeholder={spec.placeholder}
          type={spec.inputType}
          readOnly={spec.readOnly}
          onChange={(next) => onChangeValue(key, next)}
        />
      )}
    </Field>
  )
}

export function MeetingSelectField({
  nodeId,
  draft,
  onChangeValue,
  row,
  screenParams,
}: FieldProps & { screenParams: Record<string, string> }) {
  const valueOf = (key: string) => draft.values[key] ?? ''
  const spec = specOf(nodeId) as SelectSpec
  const key =
    row === undefined
      ? spec.fieldKey
      : itemKey(row.listKey, row.rowId, spec.fieldKey)
  const stored = valueOf(key)
  return (
    <Field
      htmlFor={key}
      nodeId={row === undefined || row.first ? nodeId : undefined}
      label={spec.label}
      required={spec.required}
      helperText={spec.helperText}
    >
      <SearchSelect
        id={key}
        placeholder={spec.placeholder}
        searchable={spec.searchable}
        disabled={spec.initiallyDisabled}
        sourceKey={spec.optionsSource.key}
        sourceParams={resolveParams(spec.optionsSource.params, { screenParams })}
        value={stored === '' ? null : { value: stored, label: draft.labels[key] ?? stored }}
        onSelect={(option) => onChangeValue(key, option.value, option.label)}
        chevron={<FigmaAsset screenId={SCREEN} nodeId={ASSET.chevron} className="size-4" />}
      />
    </Field>
  )
}
