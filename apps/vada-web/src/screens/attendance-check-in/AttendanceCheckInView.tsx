import { Field } from '../../components/Field'
import { MobileScreen } from '../../components/MobileScreen'
import { TextInput } from '../../components/TextInput'
import type { DataRow } from '../../data-sources/definitions'
import { NEUTRAL_BORDER, NEUTRAL_CHIP, SOFT_BOX, STATE_CHIP } from '../../design/tones'
import { ext01a } from '../../spec/screen-specs/ext01a'
import type { SubmitAction } from '../../spec/types'
import { ATTENDANCE_CHECK_IN_NODE as NODE } from './config'
import type { AttendanceCheckInModel } from './useAttendanceCheckIn'

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  return value === undefined ? '' : String(value)
}

function Brand() {
  return (
    <header className="flex items-center gap-2">
      <div className="flex size-6 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">V</div>
      <h1 className="text-xs font-semibold text-gray-700">{ext01a.meta?.title ?? ext01a.screenId}</h1>
    </header>
  )
}

function FormContent({ model }: { model: Extract<AttendanceCheckInModel, { state: 'ready' }> }) {
  const status = model.head.status?.[0]
  const blockedNote = scalar(model.form, 'blockedNote')
  const blocked = blockedNote !== ''

  return (
    <>
      <div data-node-id={NODE.head}>
        <p className="text-sm font-bold text-gray-900">{scalar(model.form, model.head.titleField)}</p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {status === undefined ? null : (
            <span data-design-state data-design-rule="state-chip" className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP[scalar(model.form, status.toneField)] ?? NEUTRAL_CHIP}`}>
              {scalar(model.form, status.field)}
            </span>
          )}
          {(model.head.items ?? []).map((item) => (
            <span key={item.field} className="text-xs text-gray-500">{scalar(model.form, item.field)}</span>
          ))}
        </div>
      </div>
      <p data-node-id={NODE.guide} className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-600">
        {(model.guide.items ?? []).map((item) => scalar(model.form, item.field)).join(' ')}
      </p>

      {blocked ? (
        <div role="status" className={`rounded-xl border p-6 text-center ${SOFT_BOX[scalar(model.form, 'blockedTone')] ?? NEUTRAL_BORDER}`}>
          <p className="text-sm font-semibold text-gray-900">{scalar(model.form, 'blockedLabel')}</p>
          <p className="pt-1 text-xs text-gray-500">{blockedNote}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {model.inputs.map(({ nodeId, spec }) => (
              <Field key={spec.fieldKey} htmlFor={spec.fieldKey} nodeId={nodeId} label={spec.label} required={spec.required} error={model.field.errors[spec.fieldKey]} helperText={spec.helperText}>
                <TextInput
                  id={spec.fieldKey}
                  inputRef={model.field.registerRef(spec.fieldKey)}
                  type={spec.inputType}
                  value={model.draft.values[spec.fieldKey] ?? spec.initialValue ?? ''}
                  placeholder={spec.placeholder}
                  hasError={model.field.errors[spec.fieldKey] !== undefined}
                  onChange={(value) => model.field.setFieldValue(spec.fieldKey, value === '' ? null : value)}
                />
              </Field>
            ))}
          </div>
          <button type="button" data-node-id={NODE.submit} onClick={model.pressSubmit} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none">
            {model.submitAction.labelOf(model.submit.action as SubmitAction, model.submit.label)}
          </button>
          {model.submitAction.errorMessage === null ? null : (
            <p role="alert" className="text-xs text-red-500">{model.submitAction.errorMessage}</p>
          )}
        </>
      )}
    </>
  )
}

export function AttendanceCheckInView({ model }: { model: AttendanceCheckInModel }) {
  return (
    <MobileScreen>
      <div className="flex flex-col gap-6 py-8">
        <Brand />
        {model.state === 'missing' ? (
          <p role="alert" className="text-sm text-red-700">{model.message}</p>
        ) : model.state === 'empty' ? (
          <p role="status" className="text-sm text-gray-600">{model.message}</p>
        ) : (
          <FormContent model={model} />
        )}
      </div>
    </MobileScreen>
  )
}
