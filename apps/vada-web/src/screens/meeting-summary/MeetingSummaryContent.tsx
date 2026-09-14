import { findDataSource } from '../../data-sources/definitions'
import { SOFT_BOX, SOFT_BOX_TEXT } from '../../design/tones'
import type { MeetingSummaryView } from './data'
import { NODE, scalar } from './spec'

/** 회의 전체 요약과 안건별 논의·결정을 표시한다. */
export function MeetingSummaryContent({ view }: { view: MeetingSummaryView }) {
  const { minutes, agendas } = view.specs
  const agendaField = (at: number) => agendas.columns?.[at]?.fields?.[0]

  return (
    <div className="flex flex-col gap-4">
      <section
        data-node-id={NODE.minutes}
        className="rounded-xl border border-gray-200 bg-white px-5 py-5"
      >
        <h2 className="text-sm font-bold text-gray-900">{minutes.title}</h2>
        <p className="pt-3 text-xs leading-6 text-gray-700">
          {view.minutesRow === null
            ? findDataSource(minutes.dataSourceKey ?? '').messages.empty
            : scalar(view.minutesRow, (minutes.items ?? [])[0]?.field)}
        </p>
      </section>

      {view.agendaRows.length === 0 ? (
        <p
          data-node-id={NODE.agendas}
          className="rounded-xl border border-gray-200 bg-white px-5 py-5 text-xs text-gray-500"
        >
          {findDataSource(agendas.dataSourceKey ?? '').messages.empty}
        </p>
      ) : (
        view.agendaRows.map((row, at) => {
          const decision = String(row[agendaField(3) ?? ''] ?? '')
          return (
            <section
              key={String(row.agendaId)}
              data-node-id={at === 0 ? NODE.agendas : undefined}
              className="rounded-xl border border-gray-200 bg-white px-5 py-5"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-600">
                  {scalar(row, agendaField(0))}
                </span>
                <span className="text-xs font-bold text-gray-800">
                  {scalar(row, agendaField(1))}
                </span>
              </span>
              <span className="block pt-3 text-xs leading-5 text-gray-600">
                {scalar(row, agendaField(2))}
              </span>
              {decision === '' ? null : (
                <span
                  data-design-rule="soft-box"
                  className={`mt-4 block rounded-lg border px-3 py-3 ${SOFT_BOX.green}`}
                >
                  <span className={`block text-xs font-semibold ${SOFT_BOX_TEXT.green.label}`}>
                    {agendas.columns?.[3]?.label}
                  </span>
                  <span
                    data-design-rule="soft-box-value"
                    className={`block pt-1 text-xs ${SOFT_BOX_TEXT.green.value}`}
                  >
                    {decision}
                  </span>
                </span>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
