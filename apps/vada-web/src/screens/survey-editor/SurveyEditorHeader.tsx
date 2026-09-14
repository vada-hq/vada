import { FigmaAsset } from '../../components/FigmaAsset'
import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import type { SubmitAction } from '../../spec/types'
import { ASSET, NODE, SCREEN, buttonAt } from './survey-spec'
import { scalar } from './survey-values'
import type { SurveyEditorModel } from './useSurveyEditor'

const BLOCKED_PRIMARY = 'bg-blue-200 text-blue-400'

export function SurveyEditorHeaderAction({ model }: { model: SurveyEditorModel }) {
  const preview = buttonAt(NODE.preview)
  return (
    <div className="flex items-center gap-2">
      <span
        data-node-id={NODE.statusChip}
        data-design-rule="state-chip"
        className={`rounded px-2 py-0.5 text-xs font-medium ${
          STATE_CHIP[scalar(model.surveyRow, model.statusChip.toneField)] ?? NEUTRAL_CHIP
        }`}
      >
        {scalar(model.surveyRow, (model.statusChip.items ?? [])[0]?.field)}
      </span>
      <button
        type="button"
        data-node-id={NODE.preview}
        onClick={model.press(preview)}
        className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.preview} className="size-3" />
        {preview.label}
      </button>
      <span className="relative inline-flex">
        <button
          type="button"
          data-node-id={NODE.activate}
          onClick={model.pressActivate}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            model.blockedNote === ''
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : BLOCKED_PRIMARY
          }`}
        >
          {model.submitAction.labelOf(model.activate.action as SubmitAction, model.activate.label)}
        </button>
        <span
          data-node-id={NODE.unmetBadge}
          className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 px-1.5 text-xs font-bold text-white"
        >
          {scalar(model.activationRow, (model.unmetBadge.items ?? [])[0]?.field)}
        </span>
      </span>
    </div>
  )
}

export function SurveyWorkspaceActions({ model }: { model: SurveyEditorModel }) {
  const editBasics = buttonAt(NODE.editBasics)
  const startEvent = buttonAt(NODE.startEvent)
  return (
    <div className="ml-auto flex gap-2">
      <button
        type="button"
        data-node-id={NODE.editBasics}
        onClick={model.press(editBasics)}
        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        {editBasics.label}
      </button>
      <button
        type="button"
        data-node-id={NODE.startEvent}
        onClick={model.press(startEvent)}
        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        {startEvent.label}
      </button>
    </div>
  )
}
