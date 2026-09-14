import { FigmaAsset } from '../../components/FigmaAsset'
import { findDataSource } from '../../data-sources/definitions'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import { HostActionButton } from './actions'
import type { MeetingLiveActions } from './actions'
import type { MeetingLiveView } from './data'
import { ASSET, HOST, NODE, SCREEN, scalar } from './spec'

interface CurrentAgendaProps {
  view: MeetingLiveView
  actions: MeetingLiveActions
}

/** 현재 안건과 그 안건에 속한 사전 자료를 표시한다. */
export function CurrentAgenda({ view, actions }: CurrentAgendaProps) {
  const { agenda, documents } = view.specs
  const agendaField = (at: number) => agenda.columns?.[at]?.fields?.[0]

  const openDocument = (file: (typeof view.currentDocuments)[number]) => {
    const action = view.openSpec?.action
    if (action === undefined || action.type !== 'download') return
    actions.setNote(`${view.openSpec?.label}: ${scalar(file, action.downloadField)}`)
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
      {view.current === undefined ? (
        <p data-node-id={NODE.agenda} className="text-xs font-normal text-gray-400">
          {findDataSource(agenda.dataSourceKey).messages.empty}
        </p>
      ) : (
        <div data-node-id={NODE.agenda}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-blue-600">
              {scalar(view.current, agendaField(0))}
            </span>
            <MeetingStateChip
              label={scalar(view.current, agendaField(1))}
              tone={scalar(view.current, agenda.columns?.[1]?.toneField)}
            />
            <span className="text-xs font-normal text-gray-400">
              {scalar(view.current, agendaField(2))}
            </span>
          </span>
          <span className="block pt-3 text-lg font-bold text-gray-900">
            {scalar(view.current, agendaField(3))}
          </span>
          <span className="block pt-2 text-xs font-normal text-gray-500">
            {scalar(view.current, agendaField(4))}
          </span>

          {actions.host ? (
            <span className="block pt-3">
              <HostActionButton
                slot={HOST.completeAgenda}
                actions={actions}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              />
            </span>
          ) : null}

          <span data-node-id={NODE.documents} className="block">
            {view.currentDocuments.map((file) => (
              <span
                key={String(file.documentId)}
                className="flex items-center gap-2 pt-4 text-xs font-normal text-blue-600"
              >
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.document} className="size-3.5" />
                <span>{scalar(file, documents.columns?.[0]?.fields?.[0])}</span>
                <button
                  type="button"
                  data-node-id={NODE.documentOpen}
                  onClick={() => openDocument(file)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  {view.openSpec?.label}
                </button>
              </span>
            ))}
          </span>
        </div>
      )}
    </section>
  )
}
