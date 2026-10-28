import {
  AddAgendaSchema,
  UpdateAgendaSchema,
  AddDecisionSchema,
  UpdateDecisionSchema,
} from '@vada/contracts'
import { useLayoutEffect, useRef } from 'react'
import { useUnsavedInput } from '@/lib/leave-guard'
import { MINUTES_TEXT as T } from './minutes-text'

// 안건 칩 이동은 논의 초안을 보존하므로 떠날 때 확인을 건너뛴다. 결정·안건 폼은 안건마다 다시 그려져
// 입력이 사라지므로, 쓰던 폼이 있으면 그때만 확인을 거친다(mtg-4 검토).
const dirtyEntries = new Set<symbol>()
export const hasDirtyEntry = () => dirtyEntries.size > 0
export function useDirtyEntry(dirty: boolean) {
  const holder = useRef(Symbol('minutes-entry'))
  useUnsavedInput(dirty)
  useLayoutEffect(() => {
    if (!dirty) return
    const mine = holder.current
    dirtyEntries.add(mine)
    return () => {
      dirtyEntries.delete(mine)
    }
  }, [dirty])
}

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
