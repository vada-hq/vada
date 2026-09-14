import { FigmaAsset } from '../../components/FigmaAsset'
import { NEUTRAL_VALUE, VALUE_TEXT } from '../../design/tones'
import { elementByNodeId } from '../../spec/screens'
import type { SummarySpec } from '../../spec/types'
import { NODE } from './spec'
import type { FinanceOverviewModel } from './useFinanceOverview'

/** 네 금액 카드와 집행률 막대를 그린다. */
export function FinanceSummary({ model }: { model: FinanceOverviewModel }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 pt-5 md:grid-cols-4">
        {model.cards.map((card) => {
          const spec = elementByNodeId(card.from, card.node).spec as SummarySpec
          const item = (spec.items ?? [])[0]
          const body = (
            <>
              <span className="flex items-center justify-between">
                <FigmaAsset screenId={card.screen} nodeId={card.asset} className="size-8" />
                {spec.action === undefined ? null : (
                  <span className="text-xs font-medium text-gray-400">{spec.action.label}</span>
                )}
              </span>
              <span className="block pt-3 text-xs font-medium text-gray-400">{spec.title}</span>
              <span
                data-design-rule="value-text"
                className={`block pt-1 text-xl font-bold ${VALUE_TEXT[card.tone] ?? NEUTRAL_VALUE}`}
              >
                {String(model.overview[item?.field ?? ''])}
              </span>
              <span className={`block pt-1 text-xs text-gray-400 ${card.noteWeight}`}>
                {String(model.overview[item?.descriptionField ?? ''])}
              </span>
            </>
          )
          const className = 'block rounded-xl border border-gray-200 bg-white p-4 text-left'
          return spec.action === undefined ? (
            <div key={card.node} data-node-id={card.node} className={className}>{body}</div>
          ) : (
            <button
              key={card.node}
              type="button"
              data-node-id={card.node}
              onClick={model.press(spec.action)}
              className={`${className} hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none`}
            >
              {body}
            </button>
          )
        })}
      </div>
      <div data-node-id={NODE.execution} className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-baseline gap-4">
          <span className="text-sm font-semibold text-gray-900">
            {String(model.overview[model.executionNote?.field ?? ''])}
          </span>
          <span className="text-sm font-medium text-gray-500">
            {String(model.overview[model.plannedNote?.field ?? ''])}
          </span>
        </div>
        <div className="mt-3 flex h-3.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-blue-600" style={{ width: `${Number(model.overview[model.spentBar?.field ?? ''])}%` }} />
          <div className="h-full bg-blue-300" style={{ width: `${Number(model.overview[model.plannedBar?.field ?? ''])}%` }} />
        </div>
        <div className="flex items-center gap-4 pt-2">
          {[model.spentBar, model.plannedBar].map((item, index) => (
            <span key={item?.label} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-blue-300'}`} />
              <span className="text-xs text-gray-500">{item?.label}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
