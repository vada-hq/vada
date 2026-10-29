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
export type AmendField = 'main' | 'extra' | 'notes'
export type AmendTexts = Pick<AmendInitial, AmendField>
const AMEND_FIELDS: readonly AmendField[] = ['main', 'extra', 'notes']
type Value = AmendInitial & { reason: string }
type Kept = ReturnType<typeof keptEntry>
const keptText = (kept: Kept, key: string) => {
  const value = kept ? (kept as Record<string, unknown>)[key] : undefined
  return typeof value === 'string' ? value : undefined
}
// 폼을 처음 연 때의 서버 값. 다시 연 폼은 그때 남긴 처음 값을 쓴다(그사이 바뀐 서버 값과 견주려고).
// 시작 글(저장 못 한 논의 초안)이 이 값과 다르면 바꾼 칸으로 보내진다.
function firstOf(kept: Kept, server: AmendTexts): AmendTexts {
  const first = kept ? (kept as Record<string, unknown>)['first'] : undefined
  if (first && typeof first === 'object') return first as AmendTexts
  return server
}
// 바꾼 칸만 보낸다. 안 바꾼 칸을 보내면 그사이 다른 사람이 고친 그 칸을 옛 글로 덮는다(mtg-6 검토).
function parseAmendEntry(kind: MinutesEntryKind, value: Value, first: AmendTexts) {
  const fields = entryFields[kind]
  const changed = (key: AmendField) => value[key] !== first[key]
  const body = {
    ...(changed('main') ? { [fields.main]: value.main } : {}),
    ...(changed('extra') ? { [fields.extra]: value.extra.trim() ? value.extra : null } : {}),
    baseVersionNo: value.baseVersionNo,
    reason: value.reason,
  }
  return kind === 'agenda'
    ? UpdateAgendaSchema.safeParse(changed('notes') ? { ...body, notes: value.notes } : body)
    : UpdateDecisionSchema.safeParse(body)
}
// 내가 고친 칸 가운데 폼을 연 뒤 서버에서도 바뀐 칸. 다시 저장하면 그 글을 덮으므로 보여 준다.
export function overlappingChanges(value: AmendTexts, first: AmendTexts, current: AmendTexts) {
  return AMEND_FIELDS.filter(key => value[key] !== first[key] && current[key] !== first[key])
}
type AmendTarget = { kind: MinutesEntryKind; id: string; agendaId: string }
export function useAmendEntry(
  { kind, id, agendaId }: AmendTarget,
  initial: AmendInitial,
  server: AmendTexts,
) {
  const scope = useMinutesScope()
  const formKey = `amend:${kind}:${id}`
  const [owner] = useState(() => Symbol(formKey))
  const [kept] = useState(() => (scope ? keptEntry(scope, formKey) : undefined))
  const [first] = useState(() => firstOf(kept, server))
  const [value, setValue] = useState<Value>(() => ({
    ...initial,
    main: kept?.main ?? initial.main,
    extra: kept?.extra ?? initial.extra,
    notes: keptText(kept, 'notes') ?? initial.notes,
    reason: keptText(kept, 'reason') ?? '',
    baseVersionNo: kept?.baseVersionNo ?? initial.baseVersionNo,
  }))
  const dirty = AMEND_FIELDS.some(key => value[key] !== first[key]) || value.reason !== ''
  useDirtyEntry(dirty)
  useEffect(() => {
    if (!scope) return
    // 같은 보관 자리에 논의·사유·처음 값도 남겨, 폼을 다시 열어도 글과 처음 판을 되살린다.
    const entry = {
      ...value,
      first,
      agendaId,
      text: [value.main, value.extra, value.notes, value.reason].filter(Boolean).join('\n'),
    }
    keepEntry(scope, formKey, dirty ? entry : null, owner)
  }, [scope, formKey, agendaId, value, first, dirty, owner])
  const forget = () => {
    if (scope) keepEntry(scope, formKey, null, owner)
  }
  const change = (key: AmendField | 'reason', text: string) =>
    setValue(before => ({ ...before, [key]: text }))
  const parse = () => parseAmendEntry(kind, value, first)
  return { value, first, change, parse, forget }
}
