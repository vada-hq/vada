import { FigmaAsset } from '../../components/FigmaAsset'
import type { MessageRoomDraftModel } from './useMessageRoomDraft'
import { ASSET, NODE, SCREEN } from './spec'

export function MessageRoomHeader({ model }: { model: MessageRoomDraftModel }) {
  const { head, close, goBack } = model
  return (
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div data-node-id={NODE.head}>
          <h2 className="text-sm font-bold text-gray-900">{head.title}</h2>
          <p className="pt-1 text-xs text-gray-400">{head.description}</p>
        </div>
        <button
          type="button"
          data-node-id={NODE.close}
          aria-label={close.label}
          onClick={() => goBack(close)}
          className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-4" />
        </button>
      </div>
  )
}
