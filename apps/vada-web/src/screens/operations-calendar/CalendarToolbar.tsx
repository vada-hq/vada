import { FigmaAsset } from '../../components/FigmaAsset'
import {
  CALENDAR_FILTER_ON,
  CALENDAR_TYPE_DOT,
  CALENDAR_TYPE_FILTER,
  CHOICE_CHIP,
} from '../../design/tones'
import type { ButtonSpec } from '../../spec/types'
import { NODE, SCREEN } from './spec'
import type { OperationsCalendarModel } from './useOperationsCalendar'

function MonthStep({
  nodeId,
  spec,
  onPress,
}: {
  nodeId: string
  spec: ButtonSpec
  onPress: (note: string) => void
}) {
  return (
    <button
      type="button"
      data-node-id={nodeId}
      aria-label={spec.label}
      onClick={() => {
        if (spec.action.type === 'pending') onPress(spec.action.note)
      }}
      className="flex size-7 items-center justify-center rounded border border-gray-200 text-gray-600"
    >
      <FigmaAsset screenId={SCREEN} nodeId={nodeId} className="size-3.5" />
    </button>
  )
}

export function CalendarToolbar({ model }: { model: OperationsCalendarModel }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MonthStep nodeId={NODE.previousMonth} spec={model.previousMonth} onPress={model.setNote} />
          <p data-node-id={NODE.month} className="text-sm font-bold text-gray-900">
            {String(model.monthRow[model.monthSpec.titleField ?? ''])}
          </p>
          <MonthStep nodeId={NODE.nextMonth} spec={model.nextMonth} onPress={model.setNote} />
        </div>

        <div
          data-node-id={NODE.filter}
          role="radiogroup"
          aria-label={model.optionSource.description}
          className="flex flex-wrap gap-2"
        >
          {model.options.map((option) => {
            const value = String(option.value)
            const selected = value === model.calendarType
            const tone = selected
              ? CALENDAR_FILTER_ON
              : (CALENDAR_TYPE_FILTER[value] ?? CHOICE_CHIP.off)
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => model.setCalendarType(value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div data-node-id={NODE.legend} className="flex flex-wrap items-center gap-4 pt-4 text-xs">
        <span className="font-semibold text-gray-600">{model.legendSpec.title}</span>
        {(model.legendSpec.items ?? []).map((item) => (
          <span key={item.value} className="flex items-center gap-1.5 text-gray-500">
            <span
              className={`size-2 rounded-full ${
                CALENDAR_TYPE_DOT[model.typeKeyOf(item.value ?? '')] ?? 'bg-gray-300'
              }`}
            />
            {item.value}
          </span>
        ))}
        <span className="text-gray-400">{model.legendSpec.description}</span>
      </div>
    </>
  )
}
