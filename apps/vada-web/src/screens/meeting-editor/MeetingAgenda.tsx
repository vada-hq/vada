import { FigmaAsset } from '../../components/FigmaAsset'
import { itemKey, rowIdsOf } from '../../spec/compute'
import type { GroupSpec, InputSpec, ListSpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { MeetingInputField, MeetingSelectField } from './MeetingFields'
import { MeetingSectionHeading } from './MeetingSection'
import { AGENDA_NODE, ASSET, NODE, SCREEN, specOf } from './meeting-spec'

interface MeetingAgendaProps {
  draft: ScopeDraft
  screenParams: Record<string, string>
  onChangeValue: (key: string, value: string, label?: string) => void
  onAdd: () => void
  onRemove: (rowId: string) => void
}

export function MeetingAgenda({
  draft,
  screenParams,
  onChangeValue,
  onAdd,
  onRemove,
}: MeetingAgendaProps) {
  const agendaList = specOf(NODE.agendaItems) as ListSpec
  const agendaRowIds = rowIdsOf(draft, agendaList.fieldKey)
  const valueOf = (key: string) => draft.values[key] ?? ''

  function agendaCard(rowId: string, index: number) {
    const first = index === 0
    const attachmentSpec = specOf(AGENDA_NODE.attachmentName) as InputSpec
    const attachmentKey = itemKey(agendaList.fieldKey, rowId, attachmentSpec.fieldKey)
    const titleValue = valueOf(itemKey(agendaList.fieldKey, rowId, agendaList.itemTitleFieldKey!))
    return (
      <div
        key={rowId}
        data-node-id={first ? NODE.agendaItems : undefined}
        className="rounded-xl border border-gray-200 bg-white"
      >
        {/* 항목 머리는 순번과 이름이다. 순번은 자리에서 나오고 이름은 칸에서 나온다. */}
        <div className="flex items-center gap-2 rounded-t-xl border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.dragHandle} className="size-3.5" />
          <span className="flex size-5 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
            {index + 1}
          </span>
          <span className="flex-1 text-sm font-bold text-gray-800">{titleValue}</span>
          <button
            type="button"
            aria-label={`${agendaList.itemNoun} ${index + 1} 삭제`}
            onClick={() => onRemove(rowId)}
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.removeRow} className="size-3.5" />
          </button>
        </div>

        <div className="flex gap-4 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <MeetingInputField
              nodeId={AGENDA_NODE.agendaTitle}
              draft={draft}
              onChangeValue={onChangeValue}
              row={{ rowId, listKey: agendaList.fieldKey, first }}
            />
            <MeetingInputField
              nodeId={AGENDA_NODE.agendaNote}
              draft={draft}
              onChangeValue={onChangeValue}
              row={{ rowId, listKey: agendaList.fieldKey, first }}
            />
            {/* 사전 자료. 값이 글이 아니라 고른 파일이고, 그려지는 것은 그 이름이다. */}
            <div
              data-node-id={first ? AGENDA_NODE.attachmentName : undefined}
              className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2.5"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.fileIcon} className="size-3.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-700">
                  {valueOf(attachmentKey) === ''
                    ? attachmentSpec.placeholder
                    : valueOf(attachmentKey)}
                </span>
                <span className="block text-xs text-gray-400">{attachmentSpec.label}</span>
              </span>
              <label
                htmlFor={attachmentKey}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
              >
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.upload} className="size-3" />
                자료 추가
                <input
                  id={attachmentKey}
                  type="file"
                  className="sr-only"
                  onChange={(event) =>
                    onChangeValue(attachmentKey, event.target.files?.[0]?.name ?? '')
                  }
                />
              </label>
            </div>
          </div>
          <div className="w-40 shrink-0">
            <MeetingSelectField
              nodeId={AGENDA_NODE.duration}
              draft={draft}
              onChangeValue={onChangeValue}
              screenParams={screenParams}
              row={{ rowId, listKey: agendaList.fieldKey, first }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <section
      data-node-id={NODE.agendaGroup}
      aria-label={(specOf(NODE.agendaGroup) as GroupSpec).title}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-4">
        <MeetingSectionHeading nodeId={NODE.agendaGroup} step={5} />
        <button
          type="button"
          onClick={onAdd}
          disabled={agendaRowIds.length >= agendaList.maxItems}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-400"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.addAgenda} className="size-3" />
          {agendaList.addLabel}
        </button>
      </div>
      {agendaRowIds.map(agendaCard)}
    </section>
  )
}
