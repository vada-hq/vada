import {
  AddAgendaSchema,
  UpdateAgendaSchema,
  AddDecisionSchema,
  UpdateDecisionSchema,
} from '@vada/contracts'
import { MINUTES_TEXT as T } from './minutes-text'

export type MinutesEntryValue = {
  title?: string | undefined
  body?: string | null | undefined
  content?: string | undefined
  rationale?: string | null | undefined
  baseVersionNo?: number | undefined
}
const AGENDA_ROWS = 2
const DECISION_ROWS = 3
export const entryFields = {
  agenda: {
    main: 'title',
    extra: 'body',
    label: T.agendaTitle,
    extraLabel: T.agendaBody,
    object: '제목을',
    rows: AGENDA_ROWS,
    add: AddAgendaSchema,
    update: UpdateAgendaSchema,
  },
  decision: {
    main: 'content',
    extra: 'rationale',
    label: T.decisionContent,
    extraLabel: T.rationale,
    object: '내용을',
    rows: DECISION_ROWS,
    add: AddDecisionSchema,
    update: UpdateDecisionSchema,
  },
} as const
export type MinutesEntryKind = keyof typeof entryFields
export function entryInitial(kind: MinutesEntryKind, initial: MinutesEntryValue = {}) {
  const fields = entryFields[kind]
  return { main: initial[fields.main] ?? '', extra: initial[fields.extra] ?? '' }
}
export function parseMinutesEntry(
  kind: MinutesEntryKind,
  initial: MinutesEntryValue | undefined,
  main: string,
  extra: string,
) {
  const fields = entryFields[kind]
  const value = { [fields.main]: main, [fields.extra]: extra.trim() ? extra : null }
  if (initial?.baseVersionNo !== undefined)
    return fields.update.safeParse({ ...value, baseVersionNo: initial.baseVersionNo })
  return fields.add.safeParse(value)
}
