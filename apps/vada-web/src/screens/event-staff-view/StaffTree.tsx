import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import { ROLE_CARD, ROLE_CHIP } from '../../design/tones'
import type { ItemListSpec, SummarySpec } from '../../spec/types'
import { ASSET, NODE, NODE_FIRST, ROLE_AVATAR, SCREEN, optional, rowsOf, scalar } from './spec'

interface StaffTreeProps {
  leaders: ItemListSpec
  departments: ItemListSpec
  leaderRows: DataRow[]
  departmentRows: DataRow[]
  leaderCard: SummarySpec
  nameSpec: SummarySpec
  leaderList: ItemListSpec
  memberList: ItemListSpec
  onNote: (note: string) => void
}

/** 책임자와 부서 목록을 조직도 형태로 배치한다. */
export function StaffTree({
  leaders,
  departments: _departments,
  leaderRows,
  departmentRows,
  leaderCard,
  nameSpec,
  leaderList,
  memberList,
  onNote,
}: StaffTreeProps) {
  return (
    <div className="flex flex-col items-center pt-6">
      <div data-node-id={NODE.leaders} className="w-44 rounded-md border border-gray-300 bg-white">
        <p className="flex items-center gap-1.5 rounded-t-md border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.leaderIcon} className="size-4" />
          {leaders.title}
        </p>
        <div className="flex flex-wrap gap-2 p-3">
          {leaderRows.map((row, index) => (
            <LeaderCard
              key={scalar(row, 'id')}
              row={row}
              spec={leaderCard}
              nodeId={index === 0 ? NODE_FIRST.leader : undefined}
            />
          ))}
        </div>
      </div>
      <span aria-hidden className="h-6 w-px bg-gray-400" />
      <div data-node-id={NODE.departments} className="flex w-full flex-wrap justify-center gap-3">
        {departmentRows.map((row, index) => (
          <DepartmentCard
            key={scalar(row, 'id')}
            row={row}
            first={index === 0}
            nameSpec={nameSpec}
            leaderList={leaderList}
            memberList={memberList}
            onNote={onNote}
          />
        ))}
      </div>
    </div>
  )
}

function LeaderCard({ row, spec, nodeId }: { row: DataRow; spec: SummarySpec; nodeId?: string }) {
  const status = spec.status?.[0]
  const tone = optional(row, status?.toneField) ?? ''
  const roleLabel = optional(row, status?.field)
  return (
    <span
      data-node-id={nodeId}
      className={`flex w-full flex-col gap-0.5 rounded-md border p-2.5 ${
        ROLE_CARD[tone] ?? 'border-gray-200 bg-white'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ROLE_AVATAR[tone] ?? ASSET.member} className="size-8" />
      <span className="pt-1 text-xs font-semibold text-gray-800">{scalar(row, spec.titleField!)}</span>
      {(spec.items ?? []).map((item, index) => (
        <span key={item.field} className={`text-[11px] ${index === 0 ? 'text-gray-500' : 'text-gray-400'}`}>
          {scalar(row, item.field!)}
        </span>
      ))}
      {roleLabel === null ? null : (
        <span className={`mt-1 w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold ${ROLE_CHIP[tone] ?? ''}`}>
          {roleLabel}
        </span>
      )}
    </span>
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

function DepartmentCard({ row, first, nameSpec, leaderList, memberList, onNote }: DepartmentCardProps) {
  const leaders = rowsOf(row, leaderList.itemsField!)
  const members = rowsOf(row, memberList.itemsField!)
  const at = (nodeId: string) => (first ? nodeId : undefined)
  return (
    <div className="w-52 rounded-md border border-gray-200 bg-white">
      <p data-node-id={at(NODE_FIRST.department)} className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-800">
        {scalar(row, nameSpec.titleField!)}
      </p>
      <div data-node-id={at(NODE_FIRST.leaderSection)} className="px-3 pt-3">
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
      <div data-node-id={at(NODE_FIRST.memberSection)} className="px-3 pt-3 pb-3">
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
      className={`mt-2 flex flex-col gap-0.5 rounded border bg-white p-2.5 ${
        accent ? 'border-blue-300' : 'border-gray-200'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.member} className="size-8" />
      <span className="pt-1 text-xs font-semibold text-gray-800">{scalar(row, spec.titleField!)}</span>
      {(spec.items ?? []).map((item, index) => (
        <span key={item.field} className={`text-[11px] ${index === 0 ? 'text-gray-500' : 'text-gray-400'}`}>
          {scalar(row, item.field!)}
        </span>
      ))}
    </span>
  )
}
