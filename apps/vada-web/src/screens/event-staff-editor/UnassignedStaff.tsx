import type { DataRow } from '../../data-sources/definitions'
import type { SummarySpec } from '../../spec/types'
import { PanelCard } from './StaffCards'
import { NODE, NODE_FIRST, POOL } from './spec'
import type { EventStaffDraftModel } from './useEventStaffDraft'

function personOf(model: EventStaffDraftModel, id: string): DataRow {
  const person = model.people.get(id)
  if (person === undefined) throw new Error(`EVT-03B의 구성원 '${id}'를 찾을 수 없습니다.`)
  return person
}

/** 부서에서 빠진 기본 조직 구성원을 별도 풀로 표시한다. */
export function UnassignedStaff({ model }: { model: EventStaffDraftModel }) {
  const { panelHead, panelList } = model.specs
  return (
    <aside aria-label={panelHead.title} className="w-56 shrink-0 rounded-md border border-gray-200 bg-white">
      <div data-node-id={NODE.panelHead} className="border-b border-gray-100 px-3 py-2.5">
        <p className="text-sm font-semibold text-gray-800">{panelHead.title}</p>
        <p className="pt-1 text-xs text-gray-400">{panelHead.description}</p>
      </div>
      <div data-node-id={NODE.panelList} className="flex flex-col gap-3 p-3">
        {model.idsAt(POOL).map((id, index) => (
          <PanelCard
            key={id}
            row={personOf(model, id)}
            spec={panelList.itemFields![0].spec as SummarySpec}
            nodeId={index === 0 ? NODE_FIRST.panelCard : undefined}
          />
        ))}
      </div>
    </aside>
  )
}
