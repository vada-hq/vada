import { useState } from 'react'
import { readListSource, readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { scalarValue } from '../../data-sources/values'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { opsMeet06a } from '../../spec/screen-specs/opsMeet06a'
import { opsMeet06b } from '../../spec/screen-specs/opsMeet06b'
import type { SummarySpec } from '../../spec/types'
import { useFieldDraft } from '../../spec/useFieldDraft'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { BASE_NODE, NODE, listAt, summaryAt } from './spec'

export function useMeetingMinutesWorkspace(
  screenParams: Record<string, string>,
  draft: ScopeDraft,
  onChangeDraft: (next: ScopeDraft) => void,
) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)
  const field = useFieldDraft({
    elements: opsMeet06b.elements,
    draft,
    onChangeDraft,
    screenParams,
  })
  const banner = elementByNodeId(opsMeet06a, BASE_NODE.banner).spec as SummarySpec
  const facts = summaryAt(NODE.facts)
  const agendas = listAt(NODE.agendas)
  const agendaFollowUps = listAt(NODE.agendaFollowUps)
  const missingParam = (opsMeet06b.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const detail = missingParam === undefined
    ? readObjectSourceOrNull(
        banner.dataSourceKey ?? '',
        resolveParams(banner.params, { screenParams }),
      )
    : null

  if (missingParam !== undefined || detail === null) {
    return {
      ready: false as const,
      submitAction,
      message: missingParam?.missingNote ?? findDataSource(banner.dataSourceKey).messages.empty,
    }
  }

  return {
    ready: true as const,
    submitAction,
    note,
    setNote,
    field,
    banner,
    facts,
    detail,
    bannerTone: scalarValue(detail, banner.toneField),
    agendaRows: readListSource(
      agendas.dataSourceKey,
      resolveParams(agendas.params, { screenParams }),
    ),
    followUpRows: readListSource(
      agendaFollowUps.dataSourceKey,
      resolveParams(agendaFollowUps.params, { screenParams }),
    ),
  }
}

export type ReadyMeetingMinutesWorkspace = Extract<
  ReturnType<typeof useMeetingMinutesWorkspace>,
  { ready: true }
>
