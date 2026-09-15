import { useState } from 'react'
import { readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { evt04b } from '../../spec/screen-specs/evt04b'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ButtonSpec, SubmitAction, SummarySpec } from '../../spec/types'
import { ATTENDANCE_QR_NODE as NODE } from './config'

export function useAttendanceQr(
  screenParams: Record<string, string>,
  onNavigate: (screenId: string, params?: Record<string, string>) => void,
) {
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()
  const head = elementByNodeId(evt04b, NODE.head).spec as SummarySpec
  const close = elementByNodeId(evt04b, NODE.close).spec as ButtonSpec
  const code = elementByNodeId(evt04b, NODE.code).spec as SummarySpec
  const state = elementByNodeId(evt04b, NODE.state).spec as SummarySpec
  const checkInWindow = elementByNodeId(evt04b, NODE.window).spec as SummarySpec
  const guide = elementByNodeId(evt04b, NODE.guide).spec as SummarySpec
  const download = elementByNodeId(evt04b, NODE.download).spec as ButtonSpec
  const regenerate = elementByNodeId(evt04b, NODE.regenerate).spec as ButtonSpec
  const deactivate = elementByNodeId(evt04b, NODE.deactivate).spec as ButtonSpec

  function goBack() {
    if (close.action.type === 'navigate') {
      onNavigate(close.action.targetScreenId, resolveParams(close.action.params, { screenParams }))
    }
  }

  const missing = (evt04b.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      state: 'missing' as const,
      message: missing.map((param) => param.missingNote).join(' '),
      goBack,
    }
  }

  const qr = readObjectSourceOrNull(
    state.dataSourceKey ?? '',
    resolveParams(state.params, { screenParams }),
  )
  if (qr === null) {
    return {
      state: 'empty' as const,
      message: findDataSource(state.dataSourceKey).messages.empty,
      head,
      close,
      goBack,
    }
  }
  const readyQr = qr

  function pressDownload() {
    if (download.action.type !== 'download') return
    setNote(`${download.label}: ${String(readyQr[download.action.downloadField] ?? '')}`)
  }

  function submit(spec: ButtonSpec) {
    setNote(null)
    void submitAction.run(spec.action as SubmitAction, { payload: {}, onNavigate })
  }

  return {
    state: 'ready' as const,
    head,
    close,
    code,
    status: state,
    checkInWindow,
    guide,
    download,
    regenerate,
    deactivate,
    qr: readyQr,
    note,
    submitAction,
    goBack,
    pressDownload,
    submit,
  }
}

export type AttendanceQrModel = ReturnType<typeof useAttendanceQr>
