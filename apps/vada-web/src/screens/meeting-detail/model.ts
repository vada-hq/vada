import { readListSource, readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, elementByNodeId, opsMeet03a } from '../../spec/screens'
import type { ItemListSpec, SummarySpec } from '../../spec/types'
import { NODE, SCREEN, VARIANTS } from './spec'

export interface MeetingDetailScreenProps {
  screenParams: Record<string, string>
  screenId?: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function meetingScalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-03A의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function meetingDetailModel({
  screenParams,
  screenId = SCREEN,
  onNavigate,
}: MeetingDetailScreenProps) {
  const variant: (typeof VARIANTS)[keyof typeof VARIANTS] | null =
    screenId === 'OPS-MEET-03B'
      ? VARIANTS['OPS-MEET-03B']
      : screenId === 'OPS-MEET-03C'
        ? VARIANTS['OPS-MEET-03C']
        : null
  const summaryAt = (nodeId: string) =>
    elementByNodeId(opsMeet03a, nodeId).spec as SummarySpec
  const listAt = (nodeId: string) => elementByNodeId(opsMeet03a, nodeId).spec as ItemListSpec
  const viewerChip = summaryAt(NODE.viewerChip)
  const roleNotice = summaryAt(NODE.roleNotice)
  const meeting = summaryAt(NODE.meeting)
  const facts = summaryAt(NODE.facts)
  const stateBanner = summaryAt(NODE.stateBanner)
  const agendaHeader = summaryAt(NODE.agendaHeader)
  const agendas = listAt(NODE.agendas)
  const documents = listAt(NODE.documents)
  const peopleHeader = summaryAt(NODE.peopleHeader)
  const people = listAt(NODE.people)
  const meta = opsMeet03a.meta
  if (meta === undefined) throw new Error('OPS-MEET-03A의 화면 카피가 없습니다.')

  const missingParam = (opsMeet03a.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(
          meeting.dataSourceKey,
          resolveParams(meeting.params, { screenParams }),
        )
      : null
  if (missingParam !== undefined || detail === null) {
    return {
      ready: false as const,
      screen: opsMeet03a,
      meta,
      onNavigate,
      message:
        missingParam !== undefined
          ? missingParam.missingNote
          : findDataSource(meeting.dataSourceKey).messages.empty,
    }
  }

  const agendaRows = readListSource(
    agendas.dataSourceKey,
    resolveParams(agendas.params, { screenParams }),
  )
  const documentRows = readListSource(
    documents.dataSourceKey,
    resolveParams(documents.params, { screenParams }),
  )
  const peopleRows = readListSource(
    people.dataSourceKey,
    resolveParams(people.params, { screenParams }),
  )
  const personField = (at: number) => people.columns?.[at]?.fields?.[0]

  return {
    ready: true as const,
    screen: opsMeet03a,
    meta,
    screenId,
    screenParams,
    onNavigate,
    variant,
    title: drawnTitleOf(opsMeet03a, screenParams),
    detail,
    viewerChip,
    roleNotice,
    meeting,
    facts,
    stateBanner,
    agendaHeader,
    agendas,
    documents,
    peopleHeader,
    people,
    agendaRows,
    documentRows,
    peopleRows,
    agendaField: (at: number) => agendas.columns?.[at]?.fields?.[0],
    personField,
    documentField: documents.columns?.[0]?.fields?.[0],
    meetingItem: (at: number) => (meeting.items ?? [])[at],
    chipsOf: (person: DataRow): DataRow[] => {
      const value = person[personField(1) ?? '']
      return Array.isArray(value) ? value : []
    },
    bannerTone: meetingScalar(detail, stateBanner.toneField ?? ''),
    breadcrumbItems: (opsMeet03a.breadcrumb?.items ?? []).map((item) =>
      item.field === undefined ? (item.value ?? '') : meetingScalar(detail, item.field),
    ),
    agendaEmptyMessage: findDataSource(agendas.dataSourceKey).messages.empty,
    peopleEmptyMessage: findDataSource(people.dataSourceKey).messages.empty,
  }
}

export type MeetingDetailModel = Extract<
  ReturnType<typeof meetingDetailModel>,
  { ready: true }
>
