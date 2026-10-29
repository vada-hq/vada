import { useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import { entryFields, type MinutesEntryKind } from './minutes-entry'
import { useAmendEntry, type AmendInitial } from './minutes-amend'
import { MINUTES_TEXT as T } from './minutes-text'

type Props = {
  kind: MinutesEntryKind
  id: string
  agendaId: string
  initial: AmendInitial
  onSave: (value: object) => Promise<string | null>
  onClose: () => void
}
const NOTES_ROWS = 8
function AmendMainField({
  kind,
  value,
  busy,
  error,
  onChange,
}: {
  kind: MinutesEntryKind
  value: string
  busy: boolean
  error: string | undefined
  onChange: (text: string) => void
}) {
  const fields = entryFields[kind]
  return (
    <Field label={fields.label} required error={error}>
      {kind === 'agenda' ? (
        <Input
          className="max-sm:min-h-11"
          value={value}
          readOnly={busy}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <Textarea
          rows={fields.rows}
          value={value}
          readOnly={busy}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}
export function MinutesAmendForm({ kind, id, agendaId, initial, onSave, onClose }: Props) {
  const entry = useAmendEntry(kind, id, agendaId, initial)
  const { value, change } = entry
  const fields = entryFields[kind]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { formRef, errors, attempt } = useFormCheck(() =>
    withContract(
      {
        [fields.main]: requiredText(value.main, fields.object),
        reason: requiredText(value.reason, '사유를'),
      },
      entry.parse(),
    ),
  )
  const close = () => {
    entry.forget()
    onClose()
  }
  const save = async () => {
    if (busy || !attempt()) return
    const parsed = entry.parse()
    if (!parsed.success) return
    setBusy(true)
    const problem = await onSave(parsed.data)
    setBusy(false)
    if (problem) setError(problem)
    else close()
  }
  return (
    <form
      ref={formRef}
      className="flex min-w-0 flex-col gap-4 rounded-sm border bg-white p-4"
      onSubmit={event => {
        event.preventDefault()
        void save()
      }}
    >
      <AmendMainField
        kind={kind}
        value={value.main}
        busy={busy}
        error={errors[fields.main]}
        onChange={text => change('main', text)}
      />
      <Field label={fields.extraLabel} optional error={errors[fields.extra]}>
        {kind === 'agenda' ? (
          <Input
            className="max-sm:min-h-11"
            value={value.extra}
            readOnly={busy}
            onChange={e => change('extra', e.target.value)}
          />
        ) : (
          <Textarea
            value={value.extra}
            readOnly={busy}
            onChange={e => change('extra', e.target.value)}
          />
        )}
      </Field>
      {kind === 'agenda' && (
        <Field label={T.discussion} optional error={errors['notes']}>
          <Textarea
            rows={NOTES_ROWS}
            className="wrap-anywhere"
            value={value.notes}
            readOnly={busy}
            onChange={e => change('notes', e.target.value)}
          />
        </Field>
      )}
      <Field label={T.amendReason} required error={errors['reason']}>
        <Input
          className="max-sm:min-h-11"
          value={value.reason}
          readOnly={busy}
          onChange={e => change('reason', e.target.value)}
        />
      </Field>
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" touch busy={busy} onClick={close}>
          {T.close}
        </Button>
        <Button type="submit" touch busy={busy}>
          {T.save}
        </Button>
      </div>
    </form>
  )
}
