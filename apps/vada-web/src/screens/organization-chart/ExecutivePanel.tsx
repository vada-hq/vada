import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import { ROLE_CARD, ROLE_CHIP } from '../../design/tones'
import type { SummarySpec } from '../../spec/types'
import { ASSET, NODE, NODE_FIRST, ROLE_AVATAR, scalar, SCREEN } from './spec'
import type { OrganizationChartModel } from './useOrganizationChart'

export function ExecutivePanel({ model }: { model: OrganizationChartModel }) {
  return (
    <div
      data-node-id={NODE.executives}
      className="w-full max-w-md rounded-md border border-gray-300 bg-white"
    >
      <p className="flex items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.executiveIcon} className="size-4" />
        {model.executives.title}
      </p>
      <div className="flex flex-wrap gap-3 px-5 pt-4">
        {model.executiveRows.map((row, index) => (
          <ExecutiveCard
            key={scalar(row, 'id')}
            row={row}
            spec={model.executiveCard}
            nodeId={index === 0 ? NODE_FIRST.executive : undefined}
          />
        ))}
      </div>
      <button
        type="button"
        data-node-id={NODE.addMember}
        onClick={() => {
          if (model.addMember.action.type === 'navigate') {
            model.onNavigate(model.addMember.action.targetScreenId)
          }
        }}
        className="flex items-center gap-1 px-5 py-3 text-xs font-medium text-blue-500 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.addMemberIcon} className="size-3" />
        {model.addMember.label}
      </button>
    </div>
  )
}

function ExecutiveCard({
  row,
  spec,
  nodeId,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
}) {
  const tone = spec.status === undefined ? '' : scalar(row, spec.status[0].toneField)
  return (
    <span
      data-node-id={nodeId}
      className={`flex w-36 flex-col gap-1 rounded-md border p-3 ${
        ROLE_CARD[tone] ?? 'border-gray-200 bg-white'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ROLE_AVATAR[tone] ?? ''} className="size-8" />
      <span className="pt-1 text-xs font-semibold text-gray-800">
        {scalar(row, spec.titleField!)}
      </span>
      {(spec.items ?? []).map((item, index) => (
        <span
          key={item.field}
          className={`text-[11px] font-medium ${index === 0 ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {scalar(row, item.field!)}
        </span>
      ))}
      {spec.status === undefined ? null : (
        <span
          className={`mt-1 w-fit rounded px-2 py-0.5 text-[11px] font-semibold ${ROLE_CHIP[tone] ?? ''}`}
        >
          {scalar(row, spec.status[0].field)}
        </span>
      )}
    </span>
  )
}
