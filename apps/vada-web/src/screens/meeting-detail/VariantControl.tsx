import { FigmaAsset } from '../../components/FigmaAsset'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import type { ButtonSpec, SummarySpec } from '../../spec/types'
import { BUTTON_LOOK, type VariantSlot, variantSpec } from './spec'
import type { MeetingDetailModel } from './model'

export function VariantButton({ model, slot }: { model: MeetingDetailModel; slot: VariantSlot }) {
  const spec = elementByNodeId(variantSpec(model.screenId), slot.node).spec as ButtonSpec
  return (
    <button
      type="button"
      data-node-id={slot.node}
      disabled={spec.initiallyDisabled}
      onClick={() => {
        if (spec.action.type === 'navigate') {
          model.onNavigate(
            spec.action.targetScreenId,
            resolveParams(spec.action.params, { screenParams: model.screenParams }),
          )
        }
      }}
      className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
        BUTTON_LOOK[slot.look] ?? ''
      }`}
    >
      {slot.asset === null ? null : (
        <FigmaAsset screenId={model.screenId} nodeId={slot.asset} className="size-3.5" />
      )}
      {spec.label}
    </button>
  )
}

export function ReadOnlyMark({ model, slot }: { model: MeetingDetailModel; slot: VariantSlot }) {
  const spec = elementByNodeId(variantSpec(model.screenId), slot.node).spec as SummarySpec
  return (
    <span data-node-id={slot.node} className="flex items-center gap-1.5 text-xs font-normal text-gray-400">
      {slot.asset === null ? null : (
        <FigmaAsset screenId={model.screenId} nodeId={slot.asset} className="size-3.5" />
      )}
      {spec.title}
    </span>
  )
}
