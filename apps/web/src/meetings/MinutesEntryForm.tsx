import { useEffect, useState } from 'react'
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
import { keepEntry, keptEntry } from './minutes-drafts'
import { useMinutesScope } from './minutes-scope'

type Props = {
  kind: MinutesEntryKind
  initial?: MinutesEntryValue | undefined
  onSave: (value: MinutesEntryValue) => Promise<string | null>
  onClose: () => void
  // 쓰던 글을 남길 이름과 그 폼이 속한 안건(새 안건 폼은 null).
  formKey: string
  agendaId: string | null
}
type Kept = { formKey: string; agendaId: string | null; main: string; extra: string }
// 쓰던 글을 회의록 화면의 자리에 남긴다. 저장하거나 닫으면 지운다.
function useKeptEntry({ formKey, agendaId, main, extra }: Kept, dirty: boolean) {
  const scope = useMinutesScope()
  useEffect(() => {
    if (!scope) return
    const text = extra.trim() ? `${main}\n${extra}` : main
    keepEntry(scope, formKey, dirty ? { agendaId, text, main, extra } : null)
  }, [scope, formKey, agendaId, main, extra, dirty])
  return () => {
    if (scope) keepEntry(scope, formKey, null)
  }
}
function useStartValues(kind: MinutesEntryKind, formKey: string, initial?: MinutesEntryValue) {
  const scope = useMinutesScope()
  const [started] = useState(initial)
  const [kept] = useState(() => (scope ? keptEntry(scope, formKey) : undefined))
  return { started, first: entryInitial(kind, started), kept }
}
export function MinutesEntryForm({ kind, initial, onSave, onClose, formKey, agendaId }: Props) {
  const fields = entryFields[kind]
  const { started, first, kept } = useStartValues(kind, formKey, initial)
  const [main, setMain] = useState(() => kept?.main ?? first.main)
  const [extra, setExtra] = useState(() => kept?.extra ?? first.extra)
  const [busy, setBusy] = useState(false)
  const dirty = main !== first.main || extra !== first.extra
  useDirtyEntry(dirty)
  const forget = useKeptEntry({ formKey, agendaId, main, extra }, dirty)
  const close = () => {
    forget()
    onClose()
  }
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
    else close()
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
