import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { getOptionSource } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { opsCal01 } from '../../spec/screen-specs/opsCal01'
import { paramsOf, targetScreenOf } from '../../spec/types'
import type { ButtonSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { NODE } from './spec'

export interface OperationsCalendarProps {
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useOperationsCalendar({ onNavigate }: OperationsCalendarProps) {
  const filterSpec = elementByNodeId(opsCal01, NODE.filter).spec as SelectSpec
  const [calendarType, setCalendarType] = useState(filterSpec.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)
  const monthSpec = elementByNodeId(opsCal01, NODE.month).spec as SummarySpec
  const previousMonth = elementByNodeId(opsCal01, NODE.previousMonth).spec as ButtonSpec
  const nextMonth = elementByNodeId(opsCal01, NODE.nextMonth).spec as ButtonSpec
  const legendSpec = elementByNodeId(opsCal01, NODE.legend).spec as SummarySpec
  const gridSpec = elementByNodeId(opsCal01, NODE.grid).spec as ItemListSpec
  const weekHeaderSpec = elementByNodeId(opsCal01, NODE.weekHeader).spec as SummarySpec
  const weekSpec = elementByNodeId(opsCal01, NODE.week).spec as ItemListSpec
  const optionSource = getOptionSource(filterSpec.optionsSource.key)
  const options = optionSource.type === 'static' ? optionSource.options : []
  const fields = { [filterSpec.fieldKey]: calendarType }
  const monthRow = readObjectSource(monthSpec.dataSourceKey ?? '')
  const weekRangeRow = readObjectSource(weekHeaderSpec.dataSourceKey ?? '')
  const days = readListSource(gridSpec.dataSourceKey, resolveParams(gridSpec.params, { fields }))
  const weekRows = readListSource(
    weekSpec.dataSourceKey,
    resolveParams(weekSpec.params, { fields }),
  )
  const dayField = gridSpec.group?.headerFields?.[0]
  const chipColumn = (gridSpec.columns ?? [])[0]
  const [typeColumn, dateColumn, titleColumn] = weekSpec.columns ?? []

  const typeKeyOf = (label: string) =>
    options.find((option) => option.label === label)?.value ?? ''

  function pressGridSchedule() {
    const action = gridSpec.itemAction
    if (action?.type === 'pending') setNote(action.note)
  }

  function pressWeek(row: DataRow) {
    const action = weekSpec.itemAction
    if (action === undefined) return
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    const target = targetScreenOf(action, row)
    if (target === null) return
    onNavigate(target, resolveParams(paramsOf(action), { row }))
  }

  return {
    screen: opsCal01,
    onNavigate,
    filterSpec,
    calendarType,
    setCalendarType,
    note,
    setNote,
    monthSpec,
    previousMonth,
    nextMonth,
    legendSpec,
    gridSpec,
    weekHeaderSpec,
    weekSpec,
    optionSource,
    options,
    monthRow,
    weekRangeRow,
    days,
    weekRows,
    dayField,
    chipColumn,
    typeColumn,
    dateColumn,
    titleColumn,
    typeKeyOf,
    pressGridSchedule,
    pressWeek,
  }
}

export type OperationsCalendarModel = ReturnType<typeof useOperationsCalendar>
