import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import {
  evaluateButtonExecution,
  getRequiredFieldCandidates,
} from '../../../../../packages/contracts/src/button-execution.mjs'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, opsMeet02 } from '../../spec/screens'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ButtonSpec, ListSpec, SubmitAction, SummarySpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import {
  addAgenda,
  addParticipant as addDraftParticipant,
  draftFromRow,
  isDraftFieldFilled,
  removeDraftRow,
} from './meeting-draft'
import { NODE, specOf } from './meeting-spec'

export interface MeetingEditorProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function useMeetingEditor({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: MeetingEditorProps) {
  const participantList = elementByNodeId(opsMeet02, NODE.participants).spec as ListSpec
  const agendaList = elementByNodeId(opsMeet02, NODE.agendaItems).spec as ListSpec
  const [seed] = useState<ScopeDraft>(() =>
    draftFromRow(
      readObjectSource(
        opsMeet02.draftFrom!.dataSourceKey,
        resolveParams(opsMeet02.draftFrom!.params, { screenParams }),
      ),
    ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()
  const setDraft = (update: (previous: ScopeDraft) => ScopeDraft) => onChangeDraft(update(draft))

  function setValue(key: string, value: string, label?: string) {
    setDraft((previous) => ({
      values: { ...previous.values, [key]: value },
      labels: label === undefined ? previous.labels : { ...previous.labels, [key]: label },
    }))
  }

  function addParticipant() {
    const candidates = participantList.candidatesSource
    if (candidates === undefined) {
      throw new Error('참가자 후보를 어디서 고르는지 명세가 말하지 않습니다.')
    }
    const next = addDraftParticipant(
      draft,
      participantList.fieldKey,
      readListSource(
        candidates.dataSourceKey,
        resolveParams(candidates.params, { fields: draft.values }),
      ),
    )
    if (next === null) {
      setNote('넣을 수 있는 구성원이 없습니다.')
      return
    }
    onChangeDraft(next)
    setNote(null)
  }

  const labelOfField = (fieldKey: string) =>
    getRequiredFieldCandidates(opsMeet02.elements).find(
      (candidate) => candidate.fieldKey === fieldKey,
    )?.label ?? fieldKey

  function pressButton(button: ButtonSpec) {
    if (button.action.type === 'pending') {
      setNote(button.action.note)
      return
    }
    const verdict = evaluateButtonExecution({
      action: button.action,
      elements: opsMeet02.elements,
      values: draft.values,
      isFilled: (candidate: { fieldKey: string; inList: string | null }) =>
        isDraftFieldFilled(draft, candidate),
    })
    if (!verdict.allowed) {
      setBlockedKeys(verdict.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    setNote(null)
    void submitAction.run(button.action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      onScopeEvent,
    })
  }

  return {
    screenParams,
    onNavigate,
    onChangeDraft,
    draft,
    participantList,
    agendaList,
    note,
    setNote,
    blockedKeys,
    submitAction,
    headingSpec: specOf(NODE.heading) as SummarySpec,
    footerNote: opsMeet02.meta?.footerNote,
    setValue,
    valueOf: (key: string) => draft.values[key] ?? '',
    addParticipant,
    removeParticipant: (rowId: string) =>
      onChangeDraft(removeDraftRow(draft, participantList.fieldKey, rowId)),
    addAgenda: () => onChangeDraft(addAgenda(draft, agendaList)),
    removeAgenda: (rowId: string) =>
      onChangeDraft(removeDraftRow(draft, agendaList.fieldKey, rowId)),
    labelOfField,
    pressButton,
  }
}

export type MeetingEditorModel = ReturnType<typeof useMeetingEditor>
