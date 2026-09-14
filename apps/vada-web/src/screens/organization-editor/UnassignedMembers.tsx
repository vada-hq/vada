import { FigmaAsset } from '../../components/FigmaAsset'
import type { SummarySpec } from '../../spec/types'
import { PersonCard } from './PersonCard'
import { ASSET, CARD_ART, NODE, NODE_FIRST, POOL, SCREEN } from './spec'
import type { OrganizationDraftModel } from './useOrganizationDraft'

/** 미배정 구성원의 검색, 재배치, 내보내기 진입점을 표시한다. */
export function UnassignedMembers({ model }: { model: OrganizationDraftModel }) {
  const { panelHead, search, panelList } = model.specs
  return (
    <aside
      className="w-72 shrink-0 rounded-md border border-gray-200 bg-white"
      {...model.dropTarget(POOL)}
    >
      <div data-node-id={NODE.panelHead} className="border-b border-gray-100 px-5 py-4">
        <p className="text-sm font-semibold text-gray-800">{panelHead.title}</p>
        <p className="pt-1 text-xs text-gray-400">
          {String(model.hint[panelHead.descriptionField!])}
        </p>
      </div>
      <div className="px-5 py-3">
        <label htmlFor={search.fieldKey} className="sr-only">{search.label}</label>
        <span
          data-node-id={NODE.search}
          className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-600/50"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.searchIcon} className="size-4 shrink-0" />
          <input
            id={search.fieldKey}
            type={search.inputType}
            value={model.query}
            placeholder={search.placeholder ?? search.label}
            onChange={(event) => model.setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
        </span>
      </div>
      <div data-node-id={NODE.panelList} className="flex flex-col gap-3 px-5 pb-5">
        {model.pooledIds.map((id, index) => (
          <div key={id}>
            <PersonCard
              row={model.personOf(id)}
              spec={panelList.itemFields![0].spec as SummarySpec}
              nodeId={index === 0 ? NODE_FIRST.panelCard : undefined}
              onDragStart={() => model.setDragging(id)}
              variant="pooled"
              art={CARD_ART.pooled}
            />
            <button
              type="button"
              onClick={() => model.removeMember(id)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.deleteIcon} className="size-3" />
              {panelList.itemRemove!.label}
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
