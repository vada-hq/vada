import { CALENDAR_CHIP, CALENDAR_DAY, NEUTRAL_CHIP } from '../../design/tones'
import type { DataRow } from '../../data-sources/definitions'
import { NODE, WEEKDAYS } from './spec'
import type { OperationsCalendarModel } from './useOperationsCalendar'

export function MonthCalendar({ model }: { model: OperationsCalendarModel }) {
  return (
    <div
      data-node-id={NODE.grid}
      className="min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div className="grid grid-cols-7 border border-gray-100 bg-gray-50">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday.label}
            className={`px-2 py-1.5 text-center text-xs font-bold ${weekday.className}`}
          >
            {weekday.label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {model.days.map((day) => {
          const label = String(day[model.dayField?.fields?.[0] ?? ''])
          const tone = String(day[model.dayField?.toneField ?? ''])
          const schedules = (day[model.gridSpec.group?.itemsField ?? ''] ?? []) as DataRow[]
          return (
            <div
              key={String(day.id)}
              className={`min-h-20 border border-gray-50 p-1 ${
                label === '' ? 'bg-gray-50' : ''
              }`}
            >
              {label === '' ? null : (
                <span
                  className={`inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold ${
                    CALENDAR_DAY[tone] ?? CALENDAR_DAY.gray
                  }`}
                >
                  {label}
                </span>
              )}
              <span className="mt-1 flex flex-col gap-1">
                {schedules.map((schedule) => (
                  <button
                    key={String(schedule.id)}
                    type="button"
                    onClick={model.pressGridSchedule}
                    aria-label={`${String(
                      schedule[model.chipColumn?.fields?.[0] ?? ''],
                    )} ${model.gridSpec.itemAction?.label ?? ''}`}
                    className={`w-full rounded border px-1.5 py-1 text-left text-[10px] font-semibold ${
                      CALENDAR_CHIP[String(schedule[model.chipColumn?.toneField ?? ''])] ??
                      NEUTRAL_CHIP
                    }`}
                  >
                    {String(schedule[model.chipColumn?.fields?.[0] ?? ''])}
                  </button>
                ))}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
