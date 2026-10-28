import { useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import { MINUTES_TEXT as T } from './minutes-text'
import {
  entryFields,
  entryInitial,
  useDirtyEntry,
  parseMinutesEntry,
  type MinutesEntryKind,
  type MinutesEntryValue,
} from './minutes-entry'

type Props = {
  kind: MinutesEntryKind
  initial?: MinutesEntryValue | undefined
  onSave: (value: MinutesEntryValue) => Promise<string | null>
  onClose: () => void
}
export function MinutesEntryForm({ kind, initial, onSave, onClose }: Props) {
  const fields = entryFields[kind]
  const [started] = useState(initial)
  const [main, setMain] = useState(() => entryInitial(kind, started).main)
  const [extra, setExtra] = useState(() => entryInitial(kind, started).extra)
  const [busy, setBusy] = useState(false)
  const first = entryInitial(kind, started)
  useDirtyEntry(main !== first.main || extra !== first.extra)
  const [error, setError] = useState<string | null>(null)
  const parsed = () => parseMinutesEntry(kind, started, main, extra)
  const { formRef, errors, attempt } = useFormCheck(() =>
    withContract({ [fields.main]: requiredText(main, fields.object) }, parsed()),
  )
  const submit = async () => {
    if (busy || !attempt()) return
    const value = parsed()
    if (!value.success) return
    setBusy(true)
    const problem = await onSave(value.data)
    setBusy(false)
    if (problem) setError(problem)
    else onClose()
  }
  return (
    <form
      ref={formRef}
      className="flex min-w-0 flex-col gap-4 rounded-sm border p-4"
      onSubmit={event => {
        event.preventDefault()
        void submit()
      }}
    >
      <Field label={fields.label} required error={errors[fields.main]}>
        <Textarea
          rows={fields.rows}
          className="wrap-anywhere"
          value={main}
          readOnly={busy}
          onChange={e => setMain(e.target.value)}
        />
      </Field>
      <Field label={fields.extraLabel} optional error={errors[fields.extra]}>
        {kind === 'agenda' ? (
          <Input
            className="max-sm:min-h-11"
            value={extra}
            readOnly={busy}
            onChange={e => setExtra(e.target.value)}
          />
        ) : (
          <Textarea value={extra} readOnly={busy} onChange={e => setExtra(e.target.value)} />
        )}
      </Field>
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" touch busy={busy} onClick={onClose}>
          {T.close}
        </Button>
        <Button type="submit" touch busy={busy}>
          {T.save}
        </Button>
      </div>
    </form>
  )
}
