import { FigmaAsset } from '../../components/FigmaAsset'
import { ASSET, NODE, SCREEN } from './spec'
import type { EventTaskDetailModel } from './useEventTaskDetail'

export function EventTaskHeaderActions({ model }: { model: EventTaskDetailModel }) {
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        data-node-id={NODE.back}
        onClick={model.pending(model.back)}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-3.5" />
        {model.back.label}
      </button>
      <button
        type="button"
        data-node-id={NODE.changeStatus}
        onClick={model.pending(model.changeStatus)}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.changeStatus} className="size-3.5" />
        {model.changeStatus.label}
      </button>
    </span>
  )
}
