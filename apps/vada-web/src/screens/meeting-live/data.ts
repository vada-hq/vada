import { readListSource, readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, opsMeet05a } from '../../spec/screens'
import type { ButtonSpec, InputSpec } from '../../spec/types'
import { NODE, listAt, summaryAt } from './spec'

/** 진행 중 회의 화면이 사용할 명세와 서버 데이터를 한 번에 해석한다. */
export function readMeetingLiveView(screenParams: Record<string, string>) {
  const meta = opsMeet05a.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-05A의 화면 카피가 없습니다.')
  }

  const specs = {
    viewerChip: summaryAt(NODE.viewerChip),
    liveStrip: summaryAt(NODE.liveStrip),
    agenda: listAt(NODE.agenda),
    documents: listAt(NODE.documents),
    discussionHeader: summaryAt(NODE.discussionHeader),
    discussionInput: elementByNodeId(opsMeet05a, NODE.discussion).spec as InputSpec,
    savedNote: summaryAt(NODE.savedNote),
    decisionHeader: summaryAt(NODE.decisionHeader),
    decision: listAt(NODE.decision),
    followUpHeader: summaryAt(NODE.followUpHeader),
    followUps: listAt(NODE.followUps),
    agendaListHeader: summaryAt(NODE.agendaListHeader),
    agendaList: listAt(NODE.agendaList),
    peopleHeader: summaryAt(NODE.peopleHeader),
    people: listAt(NODE.people),
  }

  const missingParam = (opsMeet05a.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(
          specs.liveStrip.dataSourceKey,
          resolveParams(specs.liveStrip.params, { screenParams }),
        )
      : null

  if (missingParam !== undefined || detail === null) {
    return {
      status: 'unavailable' as const,
      meta,
      message:
        missingParam?.missingNote ?? findDataSource(specs.liveStrip.dataSourceKey).messages.empty,
    }
  }

  const agendaRows = readListSource(
    specs.agenda.dataSourceKey,
    resolveParams(specs.agenda.params, { screenParams }),
  )
  const documentRows = readListSource(
    specs.documents.dataSourceKey,
    resolveParams(specs.documents.params, { screenParams }),
  )
  const followUpRows = readListSource(
    specs.followUps.dataSourceKey,
    resolveParams(specs.followUps.params, { screenParams }),
  )
  const peopleRows = readListSource(
    specs.people.dataSourceKey,
    resolveParams(specs.people.params, { screenParams }),
  )
  const current = agendaRows.find((row) => row.isCurrent === true)
  const openSpec = specs.documents.itemFields?.[0]?.spec as ButtonSpec | undefined

  return {
    status: 'ready' as const,
    meta,
    specs,
    detail,
    agendaRows,
    followUpRows,
    peopleRows,
    current,
    currentDocuments:
      current === undefined
        ? []
        : documentRows.filter((file) => file.agendaId === current.agendaId),
    openSpec,
  }
}

export type MeetingLiveView = Extract<ReturnType<typeof readMeetingLiveView>, { status: 'ready' }>
