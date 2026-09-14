import { FigmaAsset } from '../../components/FigmaAsset'
import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { scalarValue } from '../../data-sources/values'
import { columnFieldOf } from '../../spec/types'
import { ASSET, NODE, SCREEN, listAt } from './spec'

interface AgendaCardsProps {
  agendaRows: DataRow[]
  followUpRows: DataRow[]
}

/** 정리 중인 각 안건의 논의·결정·후속 업무를 표시한다. */
export function AgendaCards({ agendaRows, followUpRows }: AgendaCardsProps) {
  const agendas = listAt(NODE.agendas)
  const agendaFollowUps = listAt(NODE.agendaFollowUps)
  const agendaField = (at: number) => columnFieldOf(agendas, at)
  const followUpField = (at: number) => columnFieldOf(agendaFollowUps, at)

  return (
    <>
      {agendaRows.map((row, at) => (
        <section
          key={scalarValue(row, 'agendaId')}
          data-node-id={at === 0 ? NODE.agendas : undefined}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-5 py-4">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-blue-600">
                  {scalarValue(row, agendaField(0))}
                </span>
                <span
                  data-design-state
                  data-design-rule="state-chip"
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                    STATE_CHIP[scalarValue(row, agendas.columns?.[1]?.toneField)] ?? NEUTRAL_CHIP
                  }`}
                >
                  {scalarValue(row, agendaField(1))}
                </span>
              </span>
              <span className="block pt-2 text-sm font-bold text-gray-900">
                {scalarValue(row, agendaField(3))}
              </span>
              <span className="block pt-1 text-xs font-normal text-gray-500">
                {scalarValue(row, agendaField(4))}
              </span>
            </span>
            <span className="shrink-0 text-xs font-normal text-gray-400">
              {scalarValue(row, agendaField(2))}
            </span>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs font-bold text-gray-400">{agendas.columns?.[5]?.label}</p>
            <p className="pt-2 text-xs font-normal text-gray-700">
              {scalarValue(row, agendaField(5))}
            </p>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-400">{agendas.columns?.[6]?.label}</p>
              {scalarValue(row, agendaField(6)) === '' ? (
                <p className="pt-2 text-xs font-normal text-orange-600">
                  {scalarValue(row, agendas.columns?.[6]?.fields?.[1])}
                </p>
              ) : (
                <p className="mt-2 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-xs font-semibold text-green-900">
                  {scalarValue(row, agendaField(6))}
                </p>
              )}
            </div>

            <div
              data-node-id={at === 0 ? NODE.agendaFollowUps : undefined}
              className="mt-4 border-t border-gray-100 pt-4"
            >
              <p className="text-xs font-bold text-gray-400">{agendaFollowUps.title}</p>
              <ul className="pt-2">
                {followUpRows.length === 0 ? (
                  <li className="text-xs font-normal text-gray-400">
                    {findDataSource(agendaFollowUps.dataSourceKey).messages.empty}
                  </li>
                ) : (
                  followUpRows.map((task) => (
                    <li key={String(task.taskId)} className="flex items-start gap-2 py-1.5">
                      <FigmaAsset
                        screenId={SCREEN}
                        nodeId={ASSET.followUp}
                        className="mt-0.5 size-3.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-gray-800">
                          {scalarValue(task, followUpField(0))}
                        </span>
                        <span className="block text-xs font-normal text-gray-500">
                          {scalarValue(task, followUpField(1))}
                        </span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>
      ))}
    </>
  )
}
