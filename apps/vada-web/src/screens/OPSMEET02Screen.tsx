import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { FigmaAsset } from '../components/FigmaAsset'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import {
  evaluateButtonExecution,
  getRequiredFieldCandidates,
} from '../../../../packages/contracts/src/button-execution.mjs'
import { getMutation } from '../spec/mutations'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, opsMeet02 } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, ListSpec, SelectSpec, SubmitAction, SummarySpec } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'
import {
  addAgenda,
  addParticipant as addDraftParticipant,
  draftFromRow,
  isDraftFieldFilled,
  removeDraftRow,
} from './meeting-editor/meeting-draft'
import { MeetingAgenda } from './meeting-editor/MeetingAgenda'
import { MeetingInputField, MeetingSelectField } from './meeting-editor/MeetingFields'
import { MeetingParticipants } from './meeting-editor/MeetingParticipants'
import { MeetingSection } from './meeting-editor/MeetingSection'
import { ASSET, NODE, SCREEN, specOf } from './meeting-editor/meeting-spec'

// 회의 작성·수정 화면. 초안 편집과 UI를 연결하고 공통 검증·저장을 호출한다.
interface OPSMEET02ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(meetingDraft). 쓰던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function OPSMEET02Screen({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: OPSMEET02ScreenProps) {
  const participantList = elementByNodeId(opsMeet02, NODE.participants).spec as ListSpec
  const agendaList = elementByNodeId(opsMeet02, NODE.agendaItems).spec as ListSpec

  // 새로 쓰는 것도 읽는다 - 아직 아무것도 적히지 않은 회의가 오고, 그 안에 서버가
  // 이미 아는 것(주최자·회의 상태)이 들어 있다.
  const [seed] = useState<ScopeDraft>(() =>
    draftFromRow(
      readObjectSource(
        opsMeet02.draftFrom!.dataSourceKey,
        resolveParams(opsMeet02.draftFrom!.params, { screenParams }),
      ),
    ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const setDraft = (update: (previous: ScopeDraft) => ScopeDraft) => {
    onChangeDraft(update(draft))
  }

  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()

  function setValue(key: string, value: string, label?: string) {
    setDraft((previous) => ({
      values: { ...previous.values, [key]: value },
      labels: label === undefined ? previous.labels : { ...previous.labels, [key]: label },
    }))
  }

  function valueOf(key: string): string {
    return draft.values[key] ?? ''
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

  // 사람에게는 fieldKey가 아니라 라벨로 말한다.
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

  const headingSpec = specOf(NODE.heading) as SummarySpec

  function actionButton(nodeId: string, className: string, icon?: string) {
    const spec = specOf(nodeId) as ButtonSpec
    const running =
      spec.action.type === 'submit' && submitAction.runningKey === spec.action.mutationKey
    return (
      <button
        key={nodeId}
        type="button"
        data-node-id={nodeId}
        onClick={() => pressButton(spec)}
        className={className}
      >
        {icon === undefined ? null : (
          <FigmaAsset screenId={SCREEN} nodeId={icon} className="size-3.5" />
        )}
        {running
          ? getMutation((spec.action as SubmitAction).mutationKey).messages.submitting
          : spec.label}
      </button>
    )
  }

  return (
    <AppShell
      screenId={opsMeet02.screenId}
      activeNavigationScreenId={opsMeet02.activeNavigationScreenId}
      eyebrow={opsMeet02.meta?.eyebrow}
      title={drawnTitleOf(opsMeet02, screenParams)}
      onNavigate={onNavigate}
    >
      <div className="flex max-w-4xl flex-col gap-6">
        <div data-node-id={NODE.heading}>
          <h2 className="text-lg font-bold text-gray-900">{headingSpec.title}</h2>
          <p className="pt-1 text-xs text-gray-500">{headingSpec.description}</p>
        </div>

        <MeetingSection nodeId={NODE.typeGroup} step={1}>
          <div className="flex flex-col gap-4">
            <ChoiceGroup
              id="meetingType"
              nodeId={NODE.meetingType}
              disabled={false}
              sourceKey={(specOf(NODE.meetingType) as SelectSpec).optionsSource.key}
              sourceParams={{}}
              value={
                valueOf('meetingType') === ''
                  ? null
                  : {
                      value: valueOf('meetingType'),
                      label: draft.labels.meetingType ?? valueOf('meetingType'),
                    }
              }
              onSelect={(option) => setValue('meetingType', option.value, option.label)}
            />
            <div className="w-1/2">
              <MeetingSelectField
                nodeId={NODE.linkedEventId}
                draft={draft}
                onChangeValue={setValue}
                screenParams={screenParams}
              />
            </div>
          </div>
        </MeetingSection>

        <MeetingSection nodeId={NODE.basicGroup} step={2}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <MeetingInputField nodeId={NODE.title} draft={draft} onChangeValue={setValue} />
              <MeetingInputField nodeId={NODE.hostName} draft={draft} onChangeValue={setValue} />
              <MeetingSelectField
                nodeId={NODE.departmentId}
                draft={draft}
                onChangeValue={setValue}
                screenParams={screenParams}
              />
              <MeetingInputField nodeId={NODE.statusLabel} draft={draft} onChangeValue={setValue} />
            </div>
            <MeetingInputField nodeId={NODE.purpose} draft={draft} onChangeValue={setValue} />
          </div>
        </MeetingSection>

        <MeetingSection nodeId={NODE.scheduleGroup} step={3}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-4">
              <MeetingInputField nodeId={NODE.date} draft={draft} onChangeValue={setValue} />
              <MeetingInputField nodeId={NODE.startTime} draft={draft} onChangeValue={setValue} />
              <MeetingInputField nodeId={NODE.endTime} draft={draft} onChangeValue={setValue} />
              <MeetingSelectField
                nodeId={NODE.mode}
                draft={draft}
                onChangeValue={setValue}
                screenParams={screenParams}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MeetingInputField nodeId={NODE.place} draft={draft} onChangeValue={setValue} />
              <MeetingInputField nodeId={NODE.onlineLink} draft={draft} onChangeValue={setValue} />
            </div>
          </div>
        </MeetingSection>

        <MeetingParticipants
          draft={draft}
          onChangeValue={setValue}
          onAdd={addParticipant}
          onRemove={(rowId) => onChangeDraft(removeDraftRow(draft, participantList.fieldKey, rowId))}
          onNote={setNote}
        />

        <MeetingAgenda
          draft={draft}
          screenParams={screenParams}
          onChangeValue={setValue}
          onAdd={() => onChangeDraft(addAgenda(draft, agendaList))}
          onRemove={(rowId) => onChangeDraft(removeDraftRow(draft, agendaList.fieldKey, rowId))}
        />

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500">{opsMeet02.meta?.footerNote}</p>
          <div className="flex items-center gap-2">
            {actionButton(NODE.cancel, 'rounded-md px-4 py-2 text-sm font-medium text-gray-500')}
            {actionButton(
              NODE.saveDraft,
              'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50',
            )}
            {actionButton(
              NODE.create,
              'flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700',
              ASSET.createCheck,
            )}
          </div>
        </div>

        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="text-xs text-red-500">
            {submitAction.errorMessage}
          </p>
        )}
        {/* 보내고 나면 어디로 가는지가 아직 정해지지 않았다고 명세가 적어
            두었으면 그 글을 내놓는다. 적어만 두고 안 보여주면 보내고 나서
            아무 일도 안 일어나는 것처럼 보인다. */}
        {submitAction.pendingNote === null ? null : (
          <p role="status" className="text-xs text-gray-500">
            {submitAction.pendingNote}
          </p>
        )}
        {/* 명세가 showMissingRequiredFields라고 말한다. 무엇이 비었는지를 짚는다. */}
        {blockedKeys.length === 0 ? null : (
          <p role="alert" className="text-xs font-medium text-red-600">
            {`아직 채우지 않은 칸이 있습니다: ${blockedKeys.map(labelOfField).join(', ')}`}
          </p>
        )}
        {note === null ? null : (
          <p role="status" className="text-xs font-medium text-gray-500">
            {note}
          </p>
        )}
      </div>
    </AppShell>
  )
}
