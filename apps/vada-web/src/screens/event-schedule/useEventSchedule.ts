import { useState } from 'react'
import { readListSource } from '../../data-sources/catalog'
import { getOptionSource } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { evtSched01 } from '../../spec/screen-specs/evtSched01'
import type { ButtonSpec, ItemListSpec, SelectSpec } from '../../spec/types'
import { EVENT_SCHEDULE_NODE as NODE } from './config'

export function useEventSchedule(
  screenParams: Record<string, string>,
  onNavigate: (screenId: string, params?: Record<string, string>) => void,
) {
  const filter = elementByNodeId(evtSched01, NODE.filter).spec as SelectSpec
  const [scheduleFilter, setScheduleFilter] = useState(filter.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)
  const missing = (evtSched01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  const calendar = elementByNodeId(evtSched01, NODE.calendar).spec as ButtonSpec
  const timeline = elementByNodeId(evtSched01, NODE.timeline).spec as ItemListSpec
  const optionSource = getOptionSource(filter.optionsSource.key)
  const options = optionSource.type === 'static' ? optionSource.options : []
  const rows = readListSource(
    timeline.dataSourceKey,
    resolveParams(timeline.params, {
      screenParams,
      fields: { [filter.fieldKey]: scheduleFilter },
    }),
  )

  function pressCalendar() {
    if (calendar.action.type === 'navigate') {
      onNavigate(calendar.action.targetScreenId)
    } else if (calendar.action.type === 'pending') {
      setNote(calendar.action.note)
    }
  }

  function pressRow() {
    if (timeline.itemAction?.type === 'pending') setNote(timeline.itemAction.note)
  }

  return {
    ready: true as const,
    calendar,
    timeline,
    optionSource,
    options,
    rows,
    scheduleFilter,
    setScheduleFilter,
    note,
    setNote,
    pressCalendar,
    pressRow,
  }
}

export type ReadyEventSchedule = Extract<ReturnType<typeof useEventSchedule>, { ready: true }>
