import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { scalarValue as scalar } from '../../data-sources/values'
import { resolveParams } from '../../spec/params'
import { rec02a } from '../../spec/screens'
import type { ButtonSpec, SubmitAction, SummarySpec } from '../../spec/types'
import { useFieldDraft } from '../../spec/useFieldDraft'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { archiveEditorSpecs } from './spec'

interface ArchiveEditorOptions {
  screenParams: Record<string, string>
  scopeDraft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function draftFromRow(row: DataRow): ScopeDraft {
  const values: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(row)) values[key] = String(value)
  return { values, labels: {} }
}

/** 서버 초안, 로컬 수정, 제출 게이트와 전송 상태를 관리한다. */
export function useArchiveEditor({
  screenParams,
  scopeDraft,
  onChangeDraft,
  onNavigate,
}: ArchiveEditorOptions) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)
  const specs = archiveEditorSpecs()
  const fromServer = draftFromRow(
    readObjectSource(
      rec02a.draftFrom!.dataSourceKey,
      resolveParams(rec02a.draftFrom!.params, { screenParams }),
    ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? fromServer : scopeDraft
  const field = useFieldDraft({
    elements: rec02a.elements,
    draft,
    onChangeDraft,
    screenParams,
  })
  const objectOf = (spec: SummarySpec) =>
    readObjectSource(spec.dataSourceKey, resolveParams(spec.params, { screenParams }))

  const archiveRow = objectOf(specs.statusChip)
  const gateCheck =
    specs.requestReview.action.type === 'submit'
      ? specs.requestReview.action.executeWhen
      : undefined
  const blockedNote =
    gateCheck?.type === 'sourceAllows'
      ? scalar(
          readObjectSource(
            gateCheck.dataSourceKey,
            resolveParams(gateCheck.params, { screenParams }),
          ),
          gateCheck.blockedNoteField,
        )
      : ''
  const tocRows = readListSource(
    specs.toc.dataSourceKey,
    resolveParams(specs.toc.params, { screenParams }),
  )
  const autoFilledRow = objectOf(specs.autoFilled)
  const gateRow = objectOf(specs.gate)
  const conditionRows = readListSource(
    specs.conditions.dataSourceKey,
    resolveParams(specs.conditions.params, { screenParams }),
  )

  const valueOf = (fieldKey: string) => draft.values[fieldKey] ?? ''
  const setValue = (fieldKey: string, next: string) =>
    field.setFieldValue(fieldKey, next === '' ? null : next)

  const send = (button: ButtonSpec) => {
    if (button.action.type !== 'submit') return
    setNote(null)
    void submitAction.run(button.action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      paramSources: { screenParams },
    })
  }

  function pressRequestReview() {
    if (blockedNote !== '') {
      setNote(blockedNote)
      return
    }
    send(specs.requestReview)
  }

  return {
    screenParams,
    specs,
    field,
    draft,
    note,
    submitAction,
    archiveRow,
    blockedNote,
    tocRows,
    autoFilledRow,
    gateRow,
    conditionRows,
    objectOf,
    valueOf,
    setValue,
    send,
    pressRequestReview,
  }
}

export type ArchiveEditorModel = ReturnType<typeof useArchiveEditor>
