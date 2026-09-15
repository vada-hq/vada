import { useState } from 'react'
import { readListSource, readObjectSource, readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { getOptionSource } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { evtTask02 } from '../../spec/screen-specs/evtTask02'
import type { ButtonSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { NODE } from './spec'

export interface EventTaskDetailProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string) => void
}

export function useEventTaskDetail({ screenParams, onNavigate }: EventTaskDetailProps) {
  const back = elementByNodeId(evtTask02, NODE.back).spec as ButtonSpec
  const changeStatus = elementByNodeId(evtTask02, NODE.changeStatus).spec as ButtonSpec
  const detailSpec = elementByNodeId(evtTask02, NODE.detail).spec as SummarySpec
  const tab = elementByNodeId(evtTask02, NODE.tab).spec as SelectSpec
  const references = elementByNodeId(evtTask02, NODE.references).spec as ItemListSpec
  const work = elementByNodeId(evtTask02, NODE.work).spec as ItemListSpec
  const addFile = elementByNodeId(evtTask02, NODE.addFile).spec as ButtonSpec
  const reviewSpec = elementByNodeId(evtTask02, NODE.review).spec as SummarySpec
  const [tabValue, setTabValue] = useState(tab.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)
  const tabSource = getOptionSource(tab.optionsSource.key)
  const tabOptions = tabSource.type === 'static' ? tabSource.options : []
  const selectedTab = tabOptions.find((option) => String(option.value) === tabValue)
  const missing = (evtTask02.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      screen: evtTask02,
      message: missing.map((param) => param.missingNote).join(' '),
      messageClassName:
        'rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700',
    }
  }

  const argumentsOf = (params: SummarySpec['params']) =>
    resolveParams(params, { screenParams, fields: { [tab.fieldKey]: tabValue } })
  const detail = readObjectSourceOrNull(
    detailSpec.dataSourceKey ?? '',
    argumentsOf(detailSpec.params),
  )
  if (detail === null) {
    return {
      ready: false as const,
      screen: evtTask02,
      message: findDataSource(detailSpec.dataSourceKey ?? '').messages.empty,
      messageClassName:
        'rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600',
    }
  }

  const pending = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }

  return {
    ready: true as const,
    screen: evtTask02,
    onNavigate,
    back,
    changeStatus,
    detailSpec,
    detail,
    tab,
    tabValue,
    setTabValue,
    tabOptions,
    selectedTab,
    references,
    referenceRows: readListSource(references.dataSourceKey, argumentsOf(references.params)),
    work,
    workRows: readListSource(work.dataSourceKey, argumentsOf(work.params)),
    addFile,
    reviewSpec,
    review: readObjectSource(reviewSpec.dataSourceKey ?? '', argumentsOf(reviewSpec.params)),
    note,
    pending,
  }
}

export type EventTaskDetailModel = Extract<
  ReturnType<typeof useEventTaskDetail>,
  { ready: true }
>
