import { useEffect, useState } from 'react'
import { UpdateAgendaSchema, UpdateDecisionSchema } from '@vada/contracts'
import { keepEntry, keptEntry } from './minutes-drafts'
import { entryFields, useDirtyEntry, type MinutesEntryKind } from './minutes-entry'
import { useMinutesScope } from './minutes-scope'

export type AmendInitial = {
  main: string
  extra: string
  notes: string
  baseVersionNo: number
}
type Value = AmendInitial & { reason: string }
function extraValues(kept: ReturnType<typeof keptEntry>, notes: string) {
  return {
    notes: kept && 'notes' in kept && typeof kept.notes === 'string' ? kept.notes : notes,
    reason: kept && 'reason' in kept && typeof kept.reason === 'string' ? kept.reason : '',
  }
}
function parseAmendEntry(kind: MinutesEntryKind, value: Value) {
  const fields = entryFields[kind]
  const body = {
    [fields.main]: value.main,
    [fields.extra]: value.extra.trim() ? value.extra : null,
    baseVersionNo: value.baseVersionNo,
    reason: value.reason,
  }
  return kind === 'agenda'
    ? UpdateAgendaSchema.safeParse({ ...body, notes: value.notes })
    : UpdateDecisionSchema.safeParse(body)
}
export function useAmendEntry(
  kind: MinutesEntryKind,
  id: string,
  agendaId: string,
  initial: AmendInitial,
) {
  const scope = useMinutesScope()
  const formKey = `amend:${kind}:${id}`
  const [owner] = useState(() => Symbol(formKey))
  const [first] = useState(initial)
  const [value, setValue] = useState<Value>(() => {
    const kept = scope ? keptEntry(scope, formKey) : undefined
    return {
      ...initial,
      main: kept?.main ?? initial.main,
      extra: kept?.extra ?? initial.extra,
      ...extraValues(kept, initial.notes),
      baseVersionNo: kept?.baseVersionNo ?? initial.baseVersionNo,
    }
  })
  const dirty =
    value.main !== first.main ||
    value.extra !== first.extra ||
    value.notes !== first.notes ||
    value.reason !== ''
  useDirtyEntry(dirty)
  useEffect(() => {
    if (!scope) return
    // 같은 보관 자리에 논의·사유도 남겨, 폼을 다시 열어도 글과 처음 판을 되살린다.
    const entry = {
      ...value,
      agendaId,
      text: [value.main, value.extra, value.notes, value.reason].filter(Boolean).join('\n'),
    }
    keepEntry(scope, formKey, dirty ? entry : null, owner)
  }, [scope, formKey, agendaId, value, dirty, owner])
  const forget = () => {
    if (scope) keepEntry(scope, formKey, null, owner)
  }
  const change = (key: 'main' | 'extra' | 'notes' | 'reason', text: string) =>
    setValue(before => ({ ...before, [key]: text }))
  const parse = () => parseAmendEntry(kind, value)
  return { value, change, parse, forget }
}
