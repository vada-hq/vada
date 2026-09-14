import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import type { ItemListSpec, SummarySpec } from '../../spec/types'
import { ASSET, NODE_FIRST, SCREEN, rowsOf, scalar } from './spec'

interface DepartmentPreviewProps {
  row: DataRow
  first: boolean
  nameSpec: SummarySpec
  leaderList: ItemListSpec
  memberList: ItemListSpec
  onNote: (note: string) => void
}

/** 설정 방식으로 만들어질 부서 한 곳과 구성원을 미리 보여준다. */
export function DepartmentPreview({
  row,
  first,
  nameSpec,
  leaderList,
  memberList,
  onNote,
}: DepartmentPreviewProps) {
  const leaders = rowsOf(row, leaderList.itemsField!)
  const members = rowsOf(row, memberList.itemsField!)
  const at = (nodeId: string) => (first ? nodeId : undefined)
  return (
    <div className="w-52 self-start rounded-md border border-gray-200 bg-white">
      <p
        data-node-id={at(NODE_FIRST.department)}
        className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-800"
      >
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
          leaders.map((person) => (
            <MemberPreview
              key={scalar(person, 'id')}
              row={person}
              spec={leaderList.itemFields![0].spec as SummarySpec}
              nodeId={at(NODE_FIRST.leaderCard)}
              accent
            />
          ))
        )}
      </div>
      <div data-node-id={at(NODE_FIRST.memberSection)} className="px-3 pt-3 pb-3">
        <p className="text-xs text-gray-400">{scalar(row, memberList.titleField!)}</p>
        {members.map((person, index) => (
          <MemberPreview
            key={scalar(person, 'id')}
            row={person}
            spec={memberList.itemFields![0].spec as SummarySpec}
            nodeId={index === 0 ? at(NODE_FIRST.memberCard) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function MemberPreview({
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
      className={`mt-2 flex w-24 flex-col gap-0.5 rounded border bg-white p-2.5 ${
        accent ? 'border-blue-300' : 'border-gray-200'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.member} className="size-6" />
      <span className="pt-1 text-xs font-semibold text-gray-800">
        {scalar(row, spec.titleField!)}
      </span>
      {(spec.items ?? []).map((item, index) => (
        <span
          key={item.field}
          className={`text-[11px] ${index === 0 ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {scalar(row, item.field!)}
        </span>
      ))}
    </span>
  )
}
