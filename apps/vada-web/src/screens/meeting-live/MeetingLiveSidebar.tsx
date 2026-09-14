import { findDataSource } from '../../data-sources/definitions'
import { MeetingStateChip } from '../meeting-shared/MeetingStateChip'
import { HostActionButton } from './actions'
import type { MeetingLiveActions } from './actions'
import type { MeetingLiveView } from './data'
import { HOST, NEUTRAL_DOT, NODE, PRESENCE_DOT, drawnValue, scalar } from './spec'

interface MeetingLiveSidebarProps {
  view: MeetingLiveView
  actions: MeetingLiveActions
}

/** 전체 안건의 진행 상태와 다음 안건 동작을 표시한다. */
function AgendaList({ view, actions }: MeetingLiveSidebarProps) {
  const { agendaListHeader, agendaList } = view.specs
  const cardField = (at: number) => agendaList.columns?.[at]?.fields?.[0]

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div data-node-id={NODE.agendaListHeader} className="border-b border-gray-100 px-5 py-4">
        <span className="block text-sm font-bold text-gray-800">{agendaListHeader.title}</span>
        <span className="block pt-1 text-xs font-normal text-gray-400">
          {drawnValue(agendaListHeader, 0)}
        </span>
      </div>

      <ul data-node-id={NODE.agendaList} className="flex flex-col gap-2 px-4 py-4">
        {view.agendaRows.length === 0 ? (
          <li className="text-xs font-normal text-gray-400">
            {findDataSource(agendaList.dataSourceKey).messages.empty}
          </li>
        ) : (
          view.agendaRows.map((row) => {
            const isCurrent = row.isCurrent === true
            return (
              <li
                key={String(row.agendaId)}
                className={`rounded-lg border px-4 py-3 ${
                  isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-bold ${
                      isCurrent ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  >
                    {scalar(row, cardField(0))}
                  </span>
                  <MeetingStateChip
                    label={scalar(row, cardField(1))}
                    tone={scalar(row, agendaList.columns?.[1]?.toneField)}
                  />
                </span>
                <span className="block pt-2 text-xs font-semibold text-gray-800">
                  {scalar(row, cardField(2))}
                </span>
                <span className="flex gap-3 pt-2">
                  <span className="text-xs font-medium text-gray-400">
                    {scalar(row, cardField(3))}
                  </span>
                  <span className="text-xs font-medium text-gray-400">
                    {scalar(row, cardField(4))}
                  </span>
                </span>
              </li>
            )
          })
        )}
      </ul>

      {actions.host ? (
        <div className="px-4 pb-4">
          <HostActionButton
            slot={HOST.nextAgenda}
            actions={actions}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          />
        </div>
      ) : null}
    </section>
  )
}

/** 참석 여부와 참가 시간을 표시한다. */
function ParticipantList({ view }: Pick<MeetingLiveSidebarProps, 'view'>) {
  const { peopleHeader, people } = view.specs
  const personField = (at: number) => people.columns?.[at]?.fields?.[0]

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div data-node-id={NODE.peopleHeader} className="border-b border-gray-100 px-5 py-4">
        <span className="block text-sm font-bold text-gray-800">{peopleHeader.title}</span>
      </div>
      <ul data-node-id={NODE.people} className="px-5 py-3">
        {view.peopleRows.length === 0 ? (
          <li className="text-xs font-normal text-gray-400">
            {findDataSource(people.dataSourceKey).messages.empty}
          </li>
        ) : (
          view.peopleRows.map((person) => (
            <li key={String(person.memberId)} className="flex items-center gap-2 py-2">
              <span
                data-design-state
                data-design-rule="state-chip"
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  PRESENCE_DOT[scalar(person, people.columns?.[1]?.toneField)] ?? NEUTRAL_DOT
                }`}
              />
              <span className="min-w-0 flex-1 text-xs font-normal text-gray-700">
                {scalar(person, personField(0))}
              </span>
              <span className="shrink-0 text-xs font-normal text-gray-400">
                {scalar(person, personField(1))}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

export function MeetingLiveSidebar(props: MeetingLiveSidebarProps) {
  return (
    <div className="flex flex-col gap-4">
      <AgendaList {...props} />
      <ParticipantList view={props.view} />
    </div>
  )
}
