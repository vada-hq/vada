import { FigmaAsset } from '../../components/FigmaAsset'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import type { MeetingLiveView } from './data'
import { ASSET, NODE, SCREEN, scalar } from './spec'

export function MeetingLiveStatus({ view }: { view: MeetingLiveView }) {
  const stripItem = (at: number) => (view.specs.liveStrip.items ?? [])[at]?.field

  return (
    <section
      data-node-id={NODE.liveStrip}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3"
    >
      <span className="flex flex-wrap items-center gap-2">
        {(view.specs.liveStrip.status ?? []).map((badge) => (
          <MeetingStateChip
            key={badge.field}
            label={scalar(view.detail, badge.field)}
            tone={scalar(view.detail, badge.toneField)}
          />
        ))}
        <span className="text-xs font-semibold text-gray-700">
          {scalar(view.detail, stripItem(0))}
        </span>
        <span className="text-xs font-normal text-gray-400">·</span>
        <span className="text-xs font-normal text-gray-500">
          {scalar(view.detail, stripItem(1))}
        </span>
        <span className="text-xs font-normal text-gray-400">·</span>
        <span className="text-xs font-normal text-gray-500">
          {scalar(view.detail, stripItem(2))}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.present} className="size-4" />
        <span className="text-xs font-semibold text-gray-700">
          {scalar(view.detail, stripItem(3))}
        </span>
        <span className="text-xs font-normal text-gray-400">
          {scalar(view.detail, stripItem(4))}
        </span>
      </span>
    </section>
  )
}
