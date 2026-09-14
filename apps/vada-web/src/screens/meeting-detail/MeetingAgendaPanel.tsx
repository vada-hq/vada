import { FigmaAsset } from '../../components/FigmaAsset'
import { meetingScalar as scalar, type MeetingDetailModel } from './model'
import { ASSET, NODE, SCREEN } from './spec'

export function MeetingAgendaPanel({ model }: { model: MeetingDetailModel }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div
        data-node-id={NODE.agendaHeader}
        className="flex items-end justify-between gap-4 border-b border-gray-100 px-5 py-4"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">{model.agendaHeader.title}</span>
          <span className="block pt-1 text-xs font-normal text-gray-400">
            {scalar(model.detail, (model.agendaHeader.items ?? [])[0]?.field)}
          </span>
        </span>
        <span className="shrink-0 text-xs font-normal text-gray-400">
          {scalar(model.detail, (model.agendaHeader.items ?? [])[1]?.field)}
        </span>
      </div>

      <ul data-node-id={NODE.agendas}>
        {model.agendaRows.length === 0 ? (
          <li className="px-5 py-4 text-xs font-normal text-gray-400">
            {model.agendaEmptyMessage}
          </li>
        ) : (
          model.agendaRows.map((agenda, at) => (
            <li
              key={String(agenda.agendaId)}
              className={`flex gap-3 px-5 py-4 ${
                at === model.agendaRows.length - 1 ? '' : 'border-b border-gray-100'
              }`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                {at + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-gray-800">
                    {scalar(agenda, model.agendaField(0))}
                  </span>
                  <span className="shrink-0 text-xs font-normal text-gray-400">
                    {scalar(agenda, model.agendaField(1))}
                  </span>
                </span>
                <span className="block pt-1 text-xs font-normal text-gray-500">
                  {scalar(agenda, model.agendaField(2))}
                </span>
                <span data-node-id={at === 0 ? NODE.documents : undefined} className="block">
                  {model.documentRows
                    .filter((file) => file.agendaId === agenda.agendaId)
                    .map((file) => (
                      <span
                        key={String(file.documentId)}
                        className="flex items-center gap-1.5 pt-2 text-xs font-normal text-blue-600"
                      >
                        <FigmaAsset screenId={SCREEN} nodeId={ASSET.document} className="size-3.5" />
                        {scalar(file, model.documentField)}
                      </span>
                    ))}
                </span>
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
