import { FigmaAsset } from '../../components/FigmaAsset'
import { getMutation } from '../../spec/mutations'
import type { ButtonSpec, SubmitAction } from '../../spec/types'
import { ASSET, NODE, SCREEN, specOf } from './meeting-spec'
import type { MeetingEditorModel } from './useMeetingEditor'

function ActionButton({
  model,
  nodeId,
  className,
  icon,
}: {
  model: MeetingEditorModel
  nodeId: string
  className: string
  icon?: string
}) {
  const spec = specOf(nodeId) as ButtonSpec
  const running =
    spec.action.type === 'submit' && model.submitAction.runningKey === spec.action.mutationKey
  return (
    <button
      type="button"
      data-node-id={nodeId}
      onClick={() => model.pressButton(spec)}
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

export function MeetingEditorActions({ model }: { model: MeetingEditorModel }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-gray-500">{model.footerNote}</p>
      <div className="flex items-center gap-2">
        <ActionButton model={model} nodeId={NODE.cancel} className="rounded-md px-4 py-2 text-sm font-medium text-gray-500" />
        <ActionButton
          model={model}
          nodeId={NODE.saveDraft}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        />
        <ActionButton
          model={model}
          nodeId={NODE.create}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          icon={ASSET.createCheck}
        />
      </div>
    </div>
  )
}

export function MeetingEditorMessages({ model }: { model: MeetingEditorModel }) {
  return (
    <>
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="text-xs text-red-500">{model.submitAction.errorMessage}</p>
      )}
      {model.submitAction.pendingNote === null ? null : (
        <p role="status" className="text-xs text-gray-500">{model.submitAction.pendingNote}</p>
      )}
      {model.blockedKeys.length === 0 ? null : (
        <p role="alert" className="text-xs font-medium text-red-600">
          {`아직 채우지 않은 칸이 있습니다: ${model.blockedKeys.map(model.labelOfField).join(', ')}`}
        </p>
      )}
      {model.note === null ? null : (
        <p role="status" className="text-xs font-medium text-gray-500">{model.note}</p>
      )}
    </>
  )
}
