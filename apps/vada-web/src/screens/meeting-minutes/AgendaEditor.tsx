import { Built } from '../../components/Built'
import { FigmaAsset } from '../../components/FigmaAsset'
import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import type { DataRow } from '../../data-sources/definitions'
import { scalarValue } from '../../data-sources/values'
import { elementByNodeId } from '../../spec/screens'
import { opsMeet06b } from '../../spec/screen-specs/opsMeet06b'
import { columnFieldOf } from '../../spec/types'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec } from '../../spec/types'
import type { useFieldDraft } from '../../spec/useFieldDraft'
import type { ScopeDraft } from '../../state/scopes'
import { AgendaPicker } from './AgendaPicker'
import { ASSET, NODE, SCREEN, listAt, summaryAt } from './spec'

interface AgendaEditorProps {
  draft: ScopeDraft
  field: ReturnType<typeof useFieldDraft>
  agendaRows: DataRow[]
  followUpRows: DataRow[]
  onPending: (note: string) => void
}

/** 선택한 안건의 결정과 후속 업무 초안을 편집한다. */
export function AgendaEditor({
  draft,
  field,
  agendaRows,
  followUpRows,
  onPending,
}: AgendaEditorProps) {
  const panelHeader = summaryAt(NODE.panelHeader)
  const picker = elementByNodeId(opsMeet06b, NODE.picker).spec as SelectSpec
  const panel = listAt(NODE.panel)
  const chosen = draft.values[picker.fieldKey] ?? null
  const chosenAgenda = agendaRows.find((row) => scalarValue(row, 'agendaId') === chosen)
  const pickerParams = field.resolveSourceParams(picker)
  const panelField = (at: number) => columnFieldOf(panel, at)
  const itemKeyOf = (agendaId: string, fieldKey: string) =>
    `${panel.fieldKey ?? ''}.${agendaId}.${fieldKey}`

  const decisionInput = (panel.itemFields ?? [])[0]?.spec as InputSpec | undefined
  const noDecision = (panel.itemFields ?? [])[1]?.spec as InputSpec | undefined
  const panelFollowUps = (panel.itemFields ?? [])[2]?.spec as ItemListSpec | undefined
  const linkTask = (panel.itemFields ?? [])[3]?.spec as ButtonSpec | undefined
  const noFollowUp = (panel.itemFields ?? [])[4]?.spec as InputSpec | undefined

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div data-node-id={NODE.panelHeader} className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-bold text-gray-900">{panelHeader.title}</h2>
        <p className="pt-1 text-xs font-normal text-gray-400">{panelHeader.description}</p>
      </div>

      <Built what="안건 목록">
        <AgendaPicker
          picker={picker}
          label={panelHeader.title}
          sourceParams={pickerParams}
          chosen={chosen}
          onSelect={(option) => field.setFieldValue(picker.fieldKey, option.value, option.label)}
        />
      </Built>

      <div data-node-id={NODE.panel} className="px-5 py-4">
        {chosenAgenda === undefined ? null : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {scalarValue(chosenAgenda, panelField(0))}
              </span>
              <span
                data-design-state
                data-design-rule="state-chip"
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                  STATE_CHIP[scalarValue(chosenAgenda, panel.columns?.[1]?.toneField)] ??
                  NEUTRAL_CHIP
                }`}
              >
                {scalarValue(chosenAgenda, panelField(1))}
              </span>
            </div>
            <p className="pt-2 text-xs font-bold text-gray-900">
              {scalarValue(chosenAgenda, panelField(2))}
            </p>

            {decisionInput === undefined ? null : (
              <div data-node-id="20:2025" className="pt-4">
                <label
                  htmlFor={itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), decisionInput.fieldKey)}
                  className="block text-xs font-semibold text-gray-800"
                >
                  {decisionInput.label}
                </label>
                <textarea
                  id={itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), decisionInput.fieldKey)}
                  value={
                    draft.values[
                      itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), decisionInput.fieldKey)
                    ] ?? ''
                  }
                  placeholder={decisionInput.placeholder ?? undefined}
                  onChange={(event) =>
                    field.setFieldValue(
                      itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), decisionInput.fieldKey),
                      event.target.value === '' ? null : event.target.value,
                    )
                  }
                  className="mt-2 block w-full rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-900"
                />
              </div>
            )}

            {noDecision === undefined ? null : (
              <label
                data-node-id="20:2029"
                htmlFor={itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), noDecision.fieldKey)}
                className="flex items-center gap-2 pt-3 text-xs font-medium text-gray-600"
              >
                <input
                  type="checkbox"
                  id={itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), noDecision.fieldKey)}
                  checked={
                    (draft.values[
                      itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), noDecision.fieldKey)
                    ] ?? null) !== null
                  }
                  onChange={(event) =>
                    field.setFieldValue(
                      itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), noDecision.fieldKey),
                      event.target.checked ? 'y' : null,
                    )
                  }
                  className="size-3.5 shrink-0 accent-blue-600"
                />
                <span>{noDecision.label}</span>
              </label>
            )}

            {panelFollowUps === undefined ? null : (
              <div data-node-id="20:2035" className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-800">
                    {panelFollowUps.title}
                  </span>
                  {linkTask === undefined ? null : (
                    <button
                      type="button"
                      data-node-id="20:2039"
                      onClick={() => {
                        if (linkTask.action.type === 'pending') {
                          onPending(linkTask.action.note)
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <FigmaAsset screenId={SCREEN} nodeId={ASSET.linkTask} className="size-3.5" />
                      {linkTask.label}
                    </button>
                  )}
                </div>
                <div className="mt-2 rounded-lg border border-gray-300 px-3 py-3">
                  <ul>
                    {followUpRows.map((task) => (
                      <li key={String(task.taskId)} className="py-1 text-xs font-normal text-gray-500">
                        {scalarValue(task, columnFieldOf(panelFollowUps, 0))}
                      </li>
                    ))}
                  </ul>
                  {noFollowUp === undefined ? null : (
                    <label
                      data-node-id="20:2048"
                      htmlFor={itemKeyOf(
                        scalarValue(chosenAgenda, 'agendaId'),
                        noFollowUp.fieldKey,
                      )}
                      className="flex items-center gap-2 pt-2 text-xs font-medium text-gray-500"
                    >
                      <input
                        type="checkbox"
                        id={itemKeyOf(
                          scalarValue(chosenAgenda, 'agendaId'),
                          noFollowUp.fieldKey,
                        )}
                        checked={
                          (draft.values[
                            itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), noFollowUp.fieldKey)
                          ] ?? null) !== null
                        }
                        onChange={(event) =>
                          field.setFieldValue(
                            itemKeyOf(scalarValue(chosenAgenda, 'agendaId'), noFollowUp.fieldKey),
                            event.target.checked ? 'y' : null,
                          )
                        }
                        className="size-3.5 shrink-0 accent-blue-600"
                      />
                      <span>{noFollowUp.label}</span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
