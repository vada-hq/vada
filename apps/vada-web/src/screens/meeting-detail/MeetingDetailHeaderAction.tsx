import { FigmaAsset } from '../../components/FigmaAsset'
import { ASSET, NODE, SCREEN } from './spec'
import { meetingScalar as scalar, type MeetingDetailModel } from './model'
import { VariantButton } from './VariantControl'

export function MeetingDetailHeaderAction({ model }: { model: MeetingDetailModel }) {
  if (model.variant === null) {
    return (
      <span
        data-node-id={NODE.viewerChip}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.viewerChip} className="size-3.5" />
        {scalar(model.detail, model.viewerChip.titleField)}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2">
      {model.variant.header.map((slot) => (
        <VariantButton key={slot.node} model={model} slot={slot} />
      ))}
    </span>
  )
}
