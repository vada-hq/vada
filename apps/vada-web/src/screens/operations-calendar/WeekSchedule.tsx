import { FigmaAsset } from '../../components/FigmaAsset'
import { CALENDAR_CHIP, NEUTRAL_CHIP } from '../../design/tones'
import { ASSET, NODE, SCREEN } from './spec'
import type { OperationsCalendarModel } from './useOperationsCalendar'

export function WeekSchedule({ model }: { model: OperationsCalendarModel }) {
  return (
    <aside className="w-full shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white lg:w-72">
      <div data-node-id={NODE.weekHeader} className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-bold text-gray-800">{model.weekHeaderSpec.title}</p>
        {(model.weekHeaderSpec.items ?? []).map((item) => (
          <p key={item.field} className="pt-0.5 text-xs text-gray-400">
            {String(model.weekRangeRow[item.field ?? ''])}
          </p>
        ))}
      </div>

      <ul data-node-id={NODE.week} className="flex flex-col gap-2 p-2.5">
        {model.weekRows.map((row) => (
          <li key={String(row.id)} className="flex flex-col border border-gray-100 px-2.5 py-2.5">
            {row[model.weekSpec.itemAction?.labelField ?? ''] === undefined ? null : (
              <button
                type="button"
                onClick={() => model.pressWeek(row)}
                className="order-last flex items-center gap-1.5 pt-2 text-left text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.weekEnter}
                  className="size-3 shrink-0"
                />
                {String(row[model.weekSpec.itemAction?.labelField ?? ''])}
              </button>
            )}
            <span className="flex items-center gap-2">
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  CALENDAR_CHIP[String(row[model.typeColumn?.toneField ?? ''])] ?? NEUTRAL_CHIP
                }`}
              >
                {String(row[model.typeColumn?.fields?.[0] ?? ''])}
              </span>
              <span className="text-xs text-gray-400">
                {String(row[model.dateColumn?.fields?.[0] ?? ''])}
              </span>
            </span>
            <span className="pt-2 text-xs font-semibold text-gray-800">
              {String(row[model.titleColumn?.fields?.[0] ?? ''])}
            </span>
          </li>
        ))}
      </ul>

      {model.screen.meta?.footerNote && (
        <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
          {model.screen.meta.footerNote}
        </p>
      )}
    </aside>
  )
}
