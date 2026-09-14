import { NEUTRAL_BORDER, NEUTRAL_VALUE, SOFT_BOX, VALUE_TEXT } from '../../design/tones'
import { NODE } from './spec'
import type { EventWrapUpModel } from './useEventWrapUp'

export function EventWrapUpSummary({ model }: { model: EventWrapUpModel }) {
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 data-node-id={NODE.countsTitle} className="text-sm font-semibold text-gray-700">
          {model.countsTitle.title}
        </h2>
        <div className="flex flex-col gap-2 pt-2">
          {model.counts.map(({ nodeId, spec, row }) => {
            const item = (spec.items ?? [])[0]
            const tone = String(row[spec.toneField ?? ''])
            return (
              <div
                key={nodeId}
                data-node-id={nodeId}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                  SOFT_BOX[tone] ?? NEUTRAL_BORDER
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-xs text-gray-500">{item?.label}</span>
                  <span
                    data-design-rule="value-text"
                    className={`block pt-1 text-sm font-bold ${
                      VALUE_TEXT[tone] ?? NEUTRAL_VALUE
                    }`}
                  >
                    {String(row[item?.field ?? ''])}
                  </span>
                </span>
                {spec.action === undefined ? null : (
                  <button
                    type="button"
                    onClick={() => model.pressCount(spec, row)}
                    className="shrink-0 text-xs font-medium text-blue-500 hover:text-blue-700"
                  >
                    {`${spec.action.label} →`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section data-node-id={NODE.basics} className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">{model.basics.spec.title}</h2>
        <dl className="pt-2">
          {(model.basics.spec.items ?? []).map((item) => (
            <span key={item.label} className="flex gap-3 py-1.5">
              <dt className="w-20 shrink-0 text-xs text-gray-400">{item.label}</dt>
              <dd className="text-xs text-gray-700">
                {String(model.basics.row[item.field ?? ''])}
              </dd>
            </span>
          ))}
        </dl>
      </section>
    </div>
  )
}
