import { FigmaAsset } from '../../components/FigmaAsset'
import { ACCENT_BAR, CHOICE_CHIP, LEAD_TEXT, NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { evtSched01 } from '../../spec/screen-specs/evtSched01'
import {
  EVENT_SCHEDULE_ASSET as ASSET,
  EVENT_SCHEDULE_NODE as NODE,
  EVENT_SCHEDULE_SCREEN as SCREEN,
} from './config'
import type { ReadyEventSchedule } from './useEventSchedule'

export function EventScheduleContent({ model }: { model: ReadyEventSchedule }) {
  return (
    <>
      <div className="flex items-end justify-between gap-4 pt-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{evtSched01.meta?.title}</h2>
          <p className="pt-1 text-xs text-gray-500">{evtSched01.meta?.description}</p>
        </div>
        <button
          type="button"
          data-node-id={NODE.calendar}
          onClick={model.pressCalendar}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {model.calendar.label}
        </button>
      </div>

      {model.note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">{model.note}</p>
      )}

      <div
        data-node-id={NODE.filter}
        data-design-rule="choice-chip"
        role="radiogroup"
        aria-label={model.optionSource.description}
        className="flex flex-wrap gap-2 pt-4"
      >
        {model.options.map((option) => {
          const value = String(option.value)
          const selected = value === model.scheduleFilter
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => model.setScheduleFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                selected ? CHOICE_CHIP.on : CHOICE_CHIP.off
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <ul data-node-id={NODE.timeline} className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {model.rows.map((row) => (
          <li key={String(row.id)}>
            <button
              type="button"
              onClick={model.pressRow}
              aria-label={`${String(row.title)} ${model.timeline.itemAction?.label ?? ''}`}
              className="flex w-full items-start gap-4 border border-gray-100 px-4 py-3.5 text-left hover:bg-gray-50"
            >
              <span
                data-design-rule="lead-text"
                className={`w-14 shrink-0 pt-0.5 text-xs font-semibold ${
                  LEAD_TEXT[String(row.tone)] ?? LEAD_TEXT.gray
                }`}
              >
                {String(row.dateLabel)}
              </span>
              <span className="relative w-px shrink-0 self-stretch bg-gray-200">
                <span
                  data-design-rule="accent-bar"
                  className={`absolute top-1 -left-[2.5px] size-1.5 rounded-full ${
                    ACCENT_BAR[String(row.tone)] ?? ACCENT_BAR.gray
                  }`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-800">{String(row.title)}</span>
                  <span
                    data-design-rule="state-chip"
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      STATE_CHIP[String(row.kindTone)] ?? NEUTRAL_CHIP
                    }`}
                  >
                    {String(row.kindLabel)}
                  </span>
                </span>
                <span className="block pt-1.5 text-xs font-medium text-gray-500">{String(row.description)}</span>
                <span className="flex flex-wrap gap-x-4 pt-2 text-[10px] font-medium text-gray-400">
                  <span>{String(row.ownerNote)}</span>
                  <span>{String(row.originNote)}</span>
                </span>
              </span>
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.enter} className="mt-1 size-3 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
