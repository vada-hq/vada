import { useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import { entryFields, type MinutesEntryKind } from './minutes-entry'
import {
  overlappingChanges,
  useAmendEntry,
  type AmendField,
  type AmendInitial,
  type AmendTexts,
} from './minutes-amend'
import { MINUTES_TEXT as T, minutesConflict } from './minutes-text'

type Props = {
  kind: MinutesEntryKind
  id: string
  agendaId: string
  initial: AmendInitial
  // 지금 서버에 저장된 값. 폼을 연 뒤 다른 사람이 같은 칸을 고쳤으면 그 글을 보여 준다.
  current: AmendTexts
  // 바꾼 칸을 가르는 기준 글. 없으면 연 때의 current다(저장 못 한 초안으로 시작하면 그 초안의 기준 글).
  baseline?: AmendTexts | undefined
  onSave: (value: object) => Promise<string | null>
  onClose: () => void
}
const NOTES_ROWS = 8
// 다시 저장하면 덮게 될 상대 글을 칸마다 보인다. 확인 없이 덮지 않게, 보고 나서 저장하게 한다(mtg-6 검토).
function OverlapNotice({
  kind,
  fields,
  current,
}: {
  kind: MinutesEntryKind
  fields: AmendField[]
  current: AmendTexts
}) {
  if (!fields.length) return null
  const labels = entryFields[kind]
  const labelOf = { main: labels.label, extra: labels.extraLabel, notes: T.discussion }
  return (
    <Alert tone="warning" role="status" className="flex min-w-0 flex-col gap-2 text-sm">
      <p className="font-medium">{minutesConflict()}</p>
      {fields.map(key => (
        <div key={key} className="min-w-0">
          <p className="text-xs text-muted-foreground">{labelOf[key]}</p>
          <p className="wrap-anywhere whitespace-pre-wrap text-fg-body">{current[key]}</p>
        </div>
      ))}
    </Alert>
  )
}
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
function AmendExtraField({
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
  return (
    <Field label={entryFields[kind].extraLabel} optional error={error}>
      {kind === 'agenda' ? (
        <Input
          className="max-sm:min-h-11"
          value={value}
          readOnly={busy}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <Textarea value={value} readOnly={busy} onChange={e => onChange(e.target.value)} />
      )}
    </Field>
  )
}
export function MinutesAmendForm({
  kind,
  id,
  agendaId,
  initial,
  current,
  baseline,
  onSave,
  onClose,
}: Props) {
  const entry = useAmendEntry({ kind, id, agendaId }, initial, baseline ?? current)
  const { value, change } = entry
  const overlap = overlappingChanges(value, entry.first, current)
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
      <AmendExtraField
        kind={kind}
        value={value.extra}
        busy={busy}
        error={errors[fields.extra]}
        onChange={text => change('extra', text)}
      />
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
      <OverlapNotice kind={kind} fields={overlap} current={current} />
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
