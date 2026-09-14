import { readListSource, readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, opsMeet07, opsMeet08 } from '../../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../../spec/types'
import { ABSENTEE, NODE, listAt, summaryAt } from './spec'

/** 완료 회의록의 기본 명세, 사용자 변형, 데이터 출처를 해석한다. */
export function readMeetingSummaryView(
  screenParams: Record<string, string>,
  screenId: string,
) {
  const absent = screenId === ABSENTEE.screen
  const specs = {
    exportButton: elementByNodeId(opsMeet07, NODE.export).spec as ButtonSpec,
    banner: summaryAt(NODE.banner),
    head: summaryAt(NODE.head),
    decisionTile: summaryAt(NODE.decisionTile),
    followUpTile: summaryAt(NODE.followUpTile),
    minutes: summaryAt(NODE.minutes),
    agendas: listAt(NODE.agendas),
    followUpHeader: summaryAt(NODE.followUpHeader),
    followUps: listAt(NODE.followUps),
    people: listAt(NODE.people),
    documents: listAt(NODE.documents),
  }
  const variant = absent
    ? {
        acknowledge: elementByNodeId(opsMeet08, ABSENTEE.acknowledge.node).spec as ButtonSpec,
        myFollowUpHeader: elementByNodeId(
          opsMeet08,
          ABSENTEE.myFollowUpHeader,
        ).spec as SummarySpec,
        myFollowUps: elementByNodeId(opsMeet08, ABSENTEE.myFollowUps).spec as ItemListSpec,
      }
    : null
  const meta = (absent ? opsMeet08 : opsMeet07).meta
  if (meta === undefined) throw new Error(`${screenId}의 화면 카피가 없습니다.`)

  const missingParam = (opsMeet07.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(
          specs.banner.dataSourceKey ?? '',
          resolveParams(specs.banner.params, { screenParams }),
        )
      : null
  if (missingParam !== undefined || detail === null) {
    return {
      status: 'unavailable' as const,
      meta,
      message:
        missingParam?.missingNote ??
        findDataSource(specs.banner.dataSourceKey ?? '').messages.empty,
    }
  }

  const list = (spec: ItemListSpec) =>
    readListSource(spec.dataSourceKey ?? '', resolveParams(spec.params, { screenParams }))

  return {
    status: 'ready' as const,
    meta,
    absent,
    specs,
    variant,
    detail,
    minutesRow: readObjectSourceOrNull(
      specs.minutes.dataSourceKey ?? '',
      resolveParams(specs.minutes.params, { screenParams }),
    ),
    agendaRows: list(specs.agendas),
    followUpRows: list(specs.followUps),
    myFollowUpRows: variant === null ? [] : list(variant.myFollowUps),
    readPeople: () => list(specs.people),
    readDocuments: () => list(specs.documents),
    documentDownload: specs.documents.itemFields?.[0]?.spec as ButtonSpec | undefined,
  }
}

export type MeetingSummaryView = Extract<
  ReturnType<typeof readMeetingSummaryView>,
  { status: 'ready' }
>
