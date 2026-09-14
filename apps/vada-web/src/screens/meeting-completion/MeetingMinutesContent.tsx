import { STATE_TEXT, NEUTRAL_VALUE } from '../../design/tones'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import { meetingCompletionScalar as scalar, type MeetingCompletionModel } from './model'
import { NODE } from './spec'

export function MeetingMinutesContent({ model }: { model: MeetingCompletionModel }) {
  return (
    <div className="flex flex-col gap-4">
      <section
        data-node-id={NODE.minutes}
        className="rounded-xl border border-yellow-200 bg-white px-5 py-5"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-bold text-gray-900">{model.minutes.title}</span>
          {model.minutesRow === null ? null : (
            <span
              className={`shrink-0 text-xs font-medium ${
                STATE_TEXT[model.minutesTone] ?? NEUTRAL_VALUE
              }`}
            >
              {scalar(model.minutesRow, model.minutes.status?.[0]?.field)}
            </span>
          )}
        </div>
        <p className="pt-3 text-sm text-gray-700">
          {model.minutesRow === null
            ? model.minutesEmptyMessage
            : scalar(model.minutesRow, (model.minutes.items ?? [])[0]?.field)}
        </p>
      </section>

      {model.agendaRows.length === 0 ? (
        <p data-node-id={NODE.agendas} className="text-xs text-gray-400">
          {model.agendasEmptyMessage}
        </p>
      ) : (
        model.agendaRows.map((row, at) => (
          <section
            key={String(row.agendaId)}
            data-node-id={at === 0 ? NODE.agendas : undefined}
            className="rounded-xl border border-gray-200 bg-white px-5 py-4"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-600">
                {scalar(row, model.agendaField(0))}
              </span>
              <span className="text-xs font-bold text-gray-800">
                {scalar(row, model.agendaField(1))}
              </span>
              <MeetingStateChip
                label={scalar(row, model.agendaField(2))}
                tone={scalar(row, model.agendas.columns?.[2]?.toneField)}
              />
            </span>
            <span className="block pt-3 text-xs text-gray-600">
              {scalar(row, model.agendaField(3))}
            </span>
          </section>
        ))
      )}
    </div>
  )
}
