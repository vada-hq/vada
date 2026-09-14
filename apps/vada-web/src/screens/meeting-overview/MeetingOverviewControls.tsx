import { FigmaAsset } from '../../components/FigmaAsset'
import { PendingBox } from '../../components/PendingBox'
import { ASSET, NODE, SCREEN } from './spec'
import type { MeetingOverviewModel } from './useMeetingOverview'

export function MeetingAttention({ model }: { model: MeetingOverviewModel }) {
  return (
    <div
      data-node-id={NODE.attention}
      className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3"
    >
      <span className="flex items-center gap-3">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.attention} className="size-8 shrink-0" />
        <span>
          <span className="block text-xs font-bold text-gray-800">
            {String(model.attentionRow[model.attention.titleField ?? ''])}
          </span>
          <span className="block text-xs text-gray-500">
            {String(model.attentionRow[model.attention.descriptionField ?? ''])}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-xs text-gray-400">
        {(model.attention.items ?? [])
          .map((item) => String(model.attentionRow[item.field ?? ''] ?? ''))
          .join(' ')}
      </span>
    </div>
  )
}

export function MeetingFilters({ model }: { model: MeetingOverviewModel }) {
  // 검색과 두 필터는 디자인 프레임 18:431의 한 줄을 이룬다.
  return (
    <div className="flex items-center gap-3 pt-4">
      <label
        data-node-id={NODE.query}
        className="flex min-w-0 flex-1 items-center rounded-md border border-gray-200 bg-white px-4 py-2"
      >
        <input
          aria-label={model.query.label}
          type={model.query.inputType}
          value={model.queryValue}
          placeholder={model.query.placeholder ?? model.query.label}
          onChange={(event) => model.setQueryValue(event.target.value)}
          className="min-w-0 flex-1 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
        />
      </label>
      <PendingBox
        nodeId={NODE.filterA}
        spec={model.filterA}
        className="h-9 w-28 shrink-0 rounded-[5px] border border-gray-200 bg-white"
      />
      <PendingBox
        nodeId={NODE.filterB}
        spec={model.filterB}
        className="h-9 w-28 shrink-0 rounded-[5px] border border-gray-200 bg-white"
      />
    </div>
  )
}
