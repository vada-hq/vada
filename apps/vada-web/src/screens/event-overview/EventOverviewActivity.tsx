import { Built } from '../../components/Built'
import { FigmaAsset } from '../../components/FigmaAsset'
import { NEUTRAL_BORDER, SOFT_BOX, SOFT_BOX_TEXT } from '../../design/tones'
import { ASSET, NODE, SCREEN, STAT_TONE } from './spec'
import type { EventOverviewModel } from './useEventOverview'

export function EventOverviewActivity({ model }: { model: EventOverviewModel }) {
  return (
    <div className="flex flex-col gap-3">
      <div data-node-id={NODE.stats} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(model.stats.spec.items ?? []).map((item) => {
          const tone = STAT_TONE[item.field ?? ''] ?? 'blue'
          return (
            <span
              key={item.label}
              className={`block rounded-xl border p-3 ${SOFT_BOX[tone] ?? NEUTRAL_BORDER}`}
            >
              <span className={`block text-xs font-medium ${SOFT_BOX_TEXT[tone]?.label}`}>
                {item.label}
              </span>
              <span
                data-design-rule="soft-box-value"
                className={`block pt-1 text-xl font-bold ${SOFT_BOX_TEXT[tone]?.value}`}
              >
                {String(model.stats.row[item.field ?? ''])}
              </span>
              <span className={`block pt-1.5 text-xs ${SOFT_BOX_TEXT[tone]?.note}`}>
                {String(model.stats.row[item.descriptionField ?? ''])}
              </span>
            </span>
          )
        })}
      </div>

      <section
        data-node-id={NODE.checklist}
        className="rounded-xl border border-gray-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">{model.checklistSpec.title}</h2>
        <Built what={model.checklistSpec.title ?? '체크리스트'} read={model.readChecklist}>
          {(checklist) => (
            <ul className="pt-2">
              {checklist.map((row) => (
                <li
                  key={String(row.title)}
                  className="flex items-start gap-3 rounded border border-gray-50 py-2.5"
                >
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={
                      ASSET.checklistByTone[
                        String(row[model.checklistSpec.iconField ?? ''])
                      ] ?? ASSET.checklistByTone.red
                    }
                    className="mt-0.5 size-3"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-gray-800">
                      {String(row.title)}
                    </span>
                    <span className="block pt-1 text-xs text-gray-400">
                      {String(row.detail)}
                    </span>
                  </span>
                  {row[model.checklistSpec.itemAction?.labelField ?? ''] === undefined ? null : (
                    <button
                      type="button"
                      onClick={() => model.pressChecklist(row)}
                      className="shrink-0 text-xs font-medium text-blue-500 hover:text-blue-700"
                    >
                      {`${String(row[model.checklistSpec.itemAction?.labelField ?? ''])} →`}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Built>
      </section>

      <section
        data-node-id={NODE.changes}
        className="rounded-xl border border-gray-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">{model.changesSpec.title}</h2>
        <Built what={model.changesSpec.title ?? '최근 변경'} read={model.readChanges}>
          {(changes) => (
            <ul className="pt-2">
              {changes.map((row) => (
                <li key={String(row.title)} className="flex gap-3 py-1">
                  <span className="w-20 shrink-0 text-xs text-gray-400">{String(row.at)}</span>
                  <span className="text-xs text-gray-700">{String(row.title)}</span>
                </li>
              ))}
            </ul>
          )}
        </Built>
      </section>
    </div>
  )
}
