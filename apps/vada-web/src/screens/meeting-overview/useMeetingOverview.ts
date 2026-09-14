import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { elementByNodeId, opsMeet01a, opsMeet01c } from '../../spec/screens'
import type {
  ButtonSpec,
  InputSpec,
  ItemListSpec,
  PendingSpec,
  SummarySpec,
} from '../../spec/types'
import { CREATE_VARIANT, NODE, SCREEN } from './spec'

export interface MeetingOverviewProps {
  screenId?: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useMeetingOverview({
  screenId = SCREEN,
  onNavigate,
}: MeetingOverviewProps) {
  const create =
    screenId === CREATE_VARIANT.screen
      ? (elementByNodeId(opsMeet01c, CREATE_VARIANT.node).spec as ButtonSpec)
      : null
  const attention = elementByNodeId(opsMeet01a, NODE.attention).spec as SummarySpec
  const query = elementByNodeId(opsMeet01a, NODE.query).spec as InputSpec
  const filterA = elementByNodeId(opsMeet01a, NODE.filterA).spec as PendingSpec
  const filterB = elementByNodeId(opsMeet01a, NODE.filterB).spec as PendingSpec
  const list = elementByNodeId(opsMeet01a, NODE.groups).spec as ItemListSpec
  const [queryValue, setQueryValue] = useState(query.initialValue ?? '')

  return {
    screen: opsMeet01a,
    onNavigate,
    create,
    attention,
    attentionRow: readObjectSource(attention.dataSourceKey ?? ''),
    query,
    queryValue,
    setQueryValue,
    filterA,
    filterB,
    list,
    groups: readListSource(list.dataSourceKey, { query: queryValue }),
  }
}

export type MeetingOverviewModel = ReturnType<typeof useMeetingOverview>
