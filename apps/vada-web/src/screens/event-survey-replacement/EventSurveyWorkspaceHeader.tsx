import { WorkspaceHeader } from '../../components/WorkspaceHeader'
import { scalarValue as scalar } from '../../data-sources/values'
import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { ASSET, NODE, SCREEN } from './spec'
import type { EventSurveyReplacementModel } from './useEventSurveyReplacement'

export function EventSurveyStatusChip({ model }: { model: EventSurveyReplacementModel }) {
  const tone = scalar(model.surveyRow, model.statusChip.toneField)
  const label = scalar(model.surveyRow, (model.statusChip.items ?? [])[0]?.field)
  return (
    <span
      data-node-id={NODE.statusChip}
      data-design-rule="state-chip"
      className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP[tone] ?? NEUTRAL_CHIP}`}
    >
      {label}
    </span>
  )
}

export function EventSurveyWorkspaceHeader({
  model,
}: {
  model: EventSurveyReplacementModel
}) {
  return (
    <>
      <WorkspaceHeader
        screen={model.screen}
        screenParams={model.screenParams}
        onNavigate={model.onNavigate}
        onPending={model.setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
        actions={
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              data-node-id={NODE.editBasics}
              onClick={model.press(model.editBasics)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {model.editBasics.label}
            </button>
            <button
              type="button"
              data-node-id={NODE.startEvent}
              onClick={model.press(model.startEvent)}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {model.startEvent.label}
            </button>
          </div>
        }
      />
      {model.note === null ? null : (
        <p role="alert" className="mt-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
          {model.note}
        </p>
      )}
    </>
  )
}
