import { FigmaAsset } from '../../components/FigmaAsset'
import { NEUTRAL_BORDER, SOFT_BOX, SOFT_BOX_TEXT } from '../../design/tones'
import { ASSET, HIGHLIGHT_TONE, NODE, SCREEN } from './spec'
import type { EventOverviewModel } from './useEventOverview'

export function EventOverviewBriefing({ model }: { model: EventOverviewModel }) {
  return (
    <>
      <div
        data-node-id={NODE.briefing}
        className={`mt-6 flex gap-3 rounded-xl border p-4 ${SOFT_BOX.blue}`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.briefing} className="mt-0.5 size-3.5" />
        <span>
          {(model.briefing.spec.items ?? []).map((item, at) => (
            <span
              key={item.field}
              className={
                at === 0 ? 'block text-sm text-blue-800' : 'block pt-1 text-xs text-blue-600'
              }
            >
              {String(model.briefing.row[item.field ?? ''])}
            </span>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3">
        {model.highlights.map(({ nodeId, spec, row }) => {
          const tone = HIGHLIGHT_TONE[nodeId]
          const item = (spec.items ?? [])[0]
          return (
            <button
              key={nodeId}
              type="button"
              data-node-id={nodeId}
              onClick={() => model.pressHighlight(spec, row)}
              className={`rounded-xl border p-4 text-left hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
                SOFT_BOX[tone] ?? NEUTRAL_BORDER
              }`}
            >
              <span className="block text-xs font-medium text-gray-500">{spec.title}</span>
              <span
                data-design-rule="soft-box-value"
                className={`block pt-1 text-xl font-bold ${SOFT_BOX_TEXT[tone]?.value}`}
              >
                {String(row[item?.field ?? ''])}
              </span>
              <span className="block pt-1.5 text-xs font-medium text-gray-500">
                {`${String(row[item?.descriptionField ?? ''])} →`}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}
