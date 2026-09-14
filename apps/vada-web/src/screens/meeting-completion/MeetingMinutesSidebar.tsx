import { BANNER_TEXT, BANNER_TONE, NEUTRAL_BORDER, NEUTRAL_VALUE } from '../../design/tones'
import { meetingCompletionScalar as scalar, meetingCompletionValue, type MeetingCompletionModel } from './model'
import { NODE } from './spec'

export function MeetingMinutesSidebar({ model }: { model: MeetingCompletionModel }) {
  return (
    <div className="flex flex-col gap-4">
      <section
        data-node-id={NODE.progress}
        className="rounded-xl border border-gray-200 bg-white px-5 py-4"
      >
        <span className="text-sm font-bold text-gray-800">{model.progress.title}</span>
        <ul className="flex flex-col gap-2 pt-3">
          {model.progressRows.map((part, at) => (
            <li key={at} className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {scalar(part, model.progressField(0))}
              </span>
              <span className="text-xs font-semibold text-gray-800">
                {scalar(part, model.progressField(1))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        data-node-id={NODE.decisions}
        className="rounded-xl border border-gray-200 bg-white px-5 py-4"
      >
        <span className="block text-sm font-bold text-gray-800">{model.decisions.title}</span>
        <ul className="pt-3">
          {model.decisionRows.length === 0 ? (
            <li className="text-xs text-gray-400">{model.decisionsEmptyMessage}</li>
          ) : (
            model.decisionRows.map((row) => (
              <li
                key={String(row.agendaId)}
                className="border-l-4 border-green-400 py-1 pl-3 text-xs text-gray-700"
              >
                {scalar(row, model.decisionField)}
              </li>
            ))
          )}
        </ul>
      </section>

      <p
        data-node-id={NODE.attendanceNote}
        data-design-rule="state-banner"
        className={`rounded-xl border px-4 py-3 text-xs ${
          BANNER_TONE.blue ?? NEUTRAL_BORDER
        } ${BANNER_TEXT.blue?.note ?? NEUTRAL_VALUE}`}
      >
        {meetingCompletionValue(model.attendanceNote, 0)}
      </p>
    </div>
  )
}
