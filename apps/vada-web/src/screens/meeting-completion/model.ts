import { readFieldRows, readListSource, readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, elementByNodeId } from '../../spec/screens'
import { opsMeet06a } from '../../spec/screen-specs/opsMeet06a'
import { columnFieldOf } from '../../spec/types'
import type { ItemListSpec, SummarySpec } from '../../spec/types'
import { NODE } from './spec'

export interface MeetingCompletionProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function meetingCompletionScalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-06A의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function meetingCompletionValue(spec: SummarySpec, at: number): string {
  return (spec.items ?? [])[at]?.value ?? ''
}

export function meetingCompletionModel({ screenParams, onNavigate }: MeetingCompletionProps) {
  const summaryAt = (nodeId: string) =>
    elementByNodeId(opsMeet06a, nodeId).spec as SummarySpec
  const listAt = (nodeId: string) => elementByNodeId(opsMeet06a, nodeId).spec as ItemListSpec
  const viewerChip = summaryAt(NODE.viewerChip)
  const banner = summaryAt(NODE.banner)
  const meeting = summaryAt(NODE.meeting)
  const minutes = summaryAt(NODE.minutes)
  const agendas = listAt(NODE.agendas)
  const progress = listAt(NODE.progress)
  const decisions = listAt(NODE.decisions)
  const attendanceNote = summaryAt(NODE.attendanceNote)
  const meta = opsMeet06a.meta
  if (meta === undefined) throw new Error('OPS-MEET-06A의 화면 카피가 없습니다.')

  const missingParam = (opsMeet06a.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(
          banner.dataSourceKey,
          resolveParams(banner.params, { screenParams }),
        )
      : null
  if (missingParam !== undefined || detail === null) {
    return {
      ready: false as const,
      screen: opsMeet06a,
      meta,
      onNavigate,
      message:
        missingParam !== undefined
          ? missingParam.missingNote
          : findDataSource(banner.dataSourceKey).messages.empty,
    }
  }

  const minutesRow = readObjectSourceOrNull(
    minutes.dataSourceKey,
    resolveParams(minutes.params, { screenParams }),
  )
  const agendaRows = readListSource(
    agendas.dataSourceKey,
    resolveParams(agendas.params, { screenParams }),
  )
  const decisionRows = readListSource(
    decisions.dataSourceKey,
    resolveParams(decisions.params, { screenParams }),
  ).filter((row) => String(row[decisions.columns?.[0]?.fields?.[0] ?? ''] ?? '') !== '')

  return {
    ready: true as const,
    screen: opsMeet06a,
    meta,
    screenParams,
    onNavigate,
    title: drawnTitleOf(opsMeet06a, screenParams),
    viewerChip,
    banner,
    meeting,
    minutes,
    agendas,
    progress,
    decisions,
    attendanceNote,
    detail,
    minutesRow,
    agendaRows,
    decisionRows,
    progressRows: readFieldRows(
      progress.dataSourceKey,
      progress.itemsField,
      resolveParams(progress.params, { screenParams }),
    ),
    bannerTone: meetingCompletionScalar(detail, banner.toneField),
    minutesTone:
      minutesRow === null
        ? ''
        : meetingCompletionScalar(minutesRow, minutes.status?.[0]?.toneField),
    meetingItem: (at: number) => (meeting.items ?? [])[at]?.field,
    agendaField: (at: number) => agendas.columns?.[at]?.fields?.[0],
    progressField: (at: number) => columnFieldOf(progress, at),
    decisionField: decisions.columns?.[0]?.fields?.[0],
    breadcrumbItems: (opsMeet06a.breadcrumb?.items ?? []).map((item) =>
      item.field === undefined ? (item.value ?? '') : meetingCompletionScalar(detail, item.field),
    ),
    minutesEmptyMessage: findDataSource(minutes.dataSourceKey).messages.empty,
    agendasEmptyMessage: findDataSource(agendas.dataSourceKey).messages.empty,
    decisionsEmptyMessage: findDataSource(decisions.dataSourceKey).messages.empty,
  }
}

export type MeetingCompletionModel = Extract<
  ReturnType<typeof meetingCompletionModel>,
  { ready: true }
>
