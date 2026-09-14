import { FigmaAsset } from '../../components/FigmaAsset'
import { ASSET, NODE, SCREEN } from './spec'
import type { EventWrapUpModel } from './useEventWrapUp'

export function EventWrapUpDetails({ model }: { model: EventWrapUpModel }) {
  return (
    <div className="flex flex-col gap-3">
      <section data-node-id={NODE.remaining} className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">{model.remainingSpec.title}</h2>
        {model.remaining.length === 0 ? (
          <p data-design-state="empty" className="py-6 text-center text-xs text-gray-400">
            {model.remainingEmptyMessage}
          </p>
        ) : (
          <ul className="pt-2">
            {model.remaining.map((row) => (
              <li
                key={String(row.id)}
                className="flex items-start gap-3 rounded border border-gray-50 py-2.5"
              >
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={
                    ASSET.remainingByTone[String(row[model.remainingSpec.iconField ?? ''])] ??
                    ASSET.remainingByTone.gray
                  }
                  className="mt-0.5 size-3"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-gray-800">
                    {String(row[model.columnField(model.remainingSpec, 0)])}
                  </span>
                  <span className="block pt-1 text-xs text-gray-400">
                    {String(row[model.columnField(model.remainingSpec, 1)])}
                  </span>
                </span>
                {model.remainingSpec.itemAction === undefined ? null : (
                  <button
                    type="button"
                    onClick={() => model.pressRemaining(row)}
                    className="shrink-0 text-xs font-medium text-blue-500 hover:text-blue-700"
                  >
                    {`${model.remainingSpec.itemAction.label} →`}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-node-id={NODE.changes} className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">{model.changesSpec.title}</h2>
        {model.changes.length === 0 ? (
          <p data-design-state="empty" className="py-6 text-center text-xs text-gray-400">
            {model.changesEmptyMessage}
          </p>
        ) : (
          <ul className="pt-2">
            {model.changes.map((row) => (
              <li
                key={String(row[model.columnField(model.changesSpec, 1)])}
                className="flex gap-3 py-1"
              >
                <span className="w-20 shrink-0 text-xs text-gray-400">
                  {String(row[model.columnField(model.changesSpec, 0)])}
                </span>
                <span className="text-xs text-gray-700">
                  {String(row[model.columnField(model.changesSpec, 1)])}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
