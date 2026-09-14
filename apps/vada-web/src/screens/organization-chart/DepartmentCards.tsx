import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import type { ItemListSpec, SummarySpec } from '../../spec/types'
import { ASSET, NODE, NODE_FIRST, rowsOf, scalar, SCREEN } from './spec'
import type { OrganizationChartModel } from './useOrganizationChart'

export function DepartmentCards({ model }: { model: OrganizationChartModel }) {
  return (
    <div data-node-id={NODE.departments} className="flex w-full flex-wrap justify-center gap-3">
      {model.departmentRows.map((row, index) => (
        <DepartmentCard
          key={scalar(row, 'id')}
          row={row}
          first={index === 0}
          nameSpec={model.nameSpec}
          leaderList={model.leaderList}
          memberList={model.memberList}
          onNote={model.setNote}
        />
      ))}
    </div>
  )
}

interface DepartmentCardProps {
  row: DataRow
  first: boolean
  nameSpec: SummarySpec
  leaderList: ItemListSpec
  memberList: ItemListSpec
  onNote: (note: string) => void
}

function DepartmentCard({
  row,
  first,
  nameSpec,
  leaderList,
  memberList,
  onNote,
}: DepartmentCardProps) {
  const leaders = rowsOf(row, leaderList.itemsField!)
  const members = rowsOf(row, memberList.itemsField!)
  const at = (nodeId: string) => (first ? nodeId : undefined)

  return (
    <div className="w-72 rounded-md border border-gray-200 bg-white">
      <p
        data-node-id={at(NODE_FIRST.department)}
        className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800"
      >
        {scalar(row, nameSpec.titleField!)}
      </p>
      <div data-node-id={at(NODE_FIRST.leaderSection)} className="px-5 pt-4">
        <p className="text-xs text-gray-400">{leaderList.title}</p>
        {leaders.length === 0 ? (
          <button
            type="button"
            onClick={() => {
              if (leaderList.emptyAction?.type === 'pending') onNote(leaderList.emptyAction.note)
            }}
            className="mt-2 rounded border border-dashed border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {leaderList.emptyAction?.label}
          </button>
        ) : (
          leaders.map((leader) => (
            <MemberCard
              key={scalar(leader, 'id')}
              row={leader}
              spec={leaderList.itemFields![0].spec as SummarySpec}
              nodeId={at(NODE_FIRST.leaderCard)}
              accent
            />
          ))
        )}
      </div>
      <div data-node-id={at(NODE_FIRST.memberSection)} className="px-5 pt-4 pb-5">
        <p className="text-xs text-gray-400">{scalar(row, memberList.titleField!)}</p>
        {members.map((member, index) => (
          <MemberCard
            key={scalar(member, 'id')}
            row={member}
            spec={memberList.itemFields![0].spec as SummarySpec}
            nodeId={index === 0 ? at(NODE_FIRST.memberCard) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function MemberCard({
  row,
  spec,
  nodeId,
  accent = false,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
  accent?: boolean
}) {
  return (
    <span
      data-node-id={nodeId}
      className={`mt-2 flex flex-col gap-0.5 rounded border bg-white p-3 ${
        accent ? 'border-blue-300' : 'border-gray-200'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.member} className="size-8" />
      <span className="pt-1 text-xs font-semibold text-gray-800">
        {scalar(row, spec.titleField!)}
      </span>
      {(spec.items ?? []).map((item, index) => (
        <span key={item.field} className={`text-[11px] ${index === 0 ? 'text-gray-500' : 'text-gray-400'}`}>
          {scalar(row, item.field!)}
        </span>
      ))}
    </span>
  )
}
