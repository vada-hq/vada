import { AppShell } from '../components/AppShell'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { drawnTitleOf } from '../spec/screens'
import { opsMeet02 } from '../spec/screen-specs/opsMeet02'
import type { SelectSpec } from '../spec/types'
import { MeetingAgenda } from './meeting-editor/MeetingAgenda'
import { MeetingEditorActions, MeetingEditorMessages } from './meeting-editor/MeetingEditorActions'
import { MeetingInputField, MeetingSelectField } from './meeting-editor/MeetingFields'
import { MeetingParticipants } from './meeting-editor/MeetingParticipants'
import { MeetingSection } from './meeting-editor/MeetingSection'
import { NODE, specOf } from './meeting-editor/meeting-spec'
import { useMeetingEditor, type MeetingEditorProps } from './meeting-editor/useMeetingEditor'

// 회의 작성·수정 화면. 편집 영역과 제출 결과를 배치한다.
export function OPSMEET02Screen(props: MeetingEditorProps) {
  const model = useMeetingEditor(props)
  const { draft, setValue, valueOf } = model

  return (
    <AppShell
      screenId={opsMeet02.screenId}
      activeNavigationScreenId={opsMeet02.activeNavigationScreenId}
      eyebrow={opsMeet02.meta?.eyebrow}
      title={drawnTitleOf(opsMeet02, model.screenParams)}
      onNavigate={model.onNavigate}
    >
      <div className="flex max-w-4xl flex-col gap-6">
        <div data-node-id={NODE.heading}>
          <h2 className="text-lg font-bold text-gray-900">{model.headingSpec.title}</h2>
          <p className="pt-1 text-xs text-gray-500">{model.headingSpec.description}</p>
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
                screenParams={model.screenParams}
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
                screenParams={model.screenParams}
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
                screenParams={model.screenParams}
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
          onAdd={model.addParticipant}
          onRemove={model.removeParticipant}
          onNote={model.setNote}
        />
        <MeetingAgenda
          draft={draft}
          screenParams={model.screenParams}
          onChangeValue={setValue}
          onAdd={model.addAgenda}
          onRemove={model.removeAgenda}
        />
        <MeetingEditorActions model={model} />
        <MeetingEditorMessages model={model} />
      </div>
    </AppShell>
  )
}
