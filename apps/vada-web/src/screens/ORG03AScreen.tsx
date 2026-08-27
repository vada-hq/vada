import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { readListSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { ROLE_CARD, ROLE_CHIP } from '../design/tones'
import { drawnTitleOf, elementByNodeId, org03a } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 조직 관리 — 보기(ORG-03A). 저장된 조직도를 읽는 화면이다.
//
// **나무를 그리는 일은 명세의 것이 아니다.** 명세가 말하는 것은 회장단 하나와
// 부서 여럿이 있다는 것뿐이고, 그 둘을 선으로 잇는 것은 design이 정한다.
//
// 회장단이 부서 목록과 따로 오는 이유는 **늘 있는 자리**이기 때문이다. 부서는
// 사람이 더하고 지우지만(ORG-02) 회장단은 그렇지 않다 - list.rootItem이 조직을
// 만들 때 같은 것을 말한다.
//
// 여기서 새로 쓰는 두 어휘.
// · itemList.emptyAction — 부서장이 **없는 부서에만** '＋ 부서장 지정'이 그려진다.
//   있고 없고가 표현이 아니라 뜻이라 명세가 갖는다.
// · itemList.titleField — '부원 2명'이 디자인에 글자 하나로 그려져 있다. 라벨과
//   숫자를 따로 갖고 화면이 다시 이으면 잇는 방법을 명세가 정하게 된다.

const SCREEN = 'ORG-03A'

const NODE = {
  breadcrumb: '30:4501',
  executives: '30:4515',
  addMember: '30:4552',
  departments: '30:4558',
} as const

// 되풀이되는 묶음은 **첫 사본의 노드만** 등록한다. 나머지 부서는 같은 틀이다.
const NODE_FIRST = {
  executive: '30:4524',
  department: '30:4564',
  leaderSection: '30:4568',
  leaderCard: '30:4572',
  memberSection: '30:4583',
  memberCard: '30:4588',
} as const

const ASSET = {
  breadcrumbSeparator: '30:4505',
  executiveIcon: '30:4518',
  addMemberIcon: '30:4553',
  // 사람 그림이 셋이다. 회장·부회장은 카드 색이 물들어 그림도 다르고, 그 밖의
  // 사람은 전부 같다(design이 자리마다 따로 뽑지만 내용이 같다).
  member: '30:4573',
} as const

// 자리 색이 그림까지 정한다. 어느 톤이 어느 그림인지는 design이 아는 것이라
// 명세가 아니라 화면이 갖는다(OPS-00의 카드 톤과 같은 규칙).
const ROLE_AVATAR: Record<string, string> = {
  yellow: '30:4526',
  blue: '30:4540',
}

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`ORG-03A의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`ORG-03A의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}

interface ORG03AScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG03AScreen({ onNavigate }: ORG03AScreenProps) {
  const [note, setNote] = useState<string | null>(null)

  const executives = elementByNodeId(org03a, NODE.executives).spec as ItemListSpec
  const addMember = elementByNodeId(org03a, NODE.addMember).spec as ButtonSpec
  const departments = elementByNodeId(org03a, NODE.departments).spec as ItemListSpec

  const executiveRows = readListSource(executives.dataSourceKey)
  const departmentRows = readListSource(departments.dataSourceKey)

  const executiveCard = executives.itemFields![0].spec as SummarySpec
  const [nameSpec, leaderList, memberList] = departments.itemFields!.map((entry) => entry.spec)
  const breadcrumb = org03a.breadcrumb

  return (
    <AppShell
      screenId={org03a.screenId}
      activeNavigationScreenId={org03a.activeNavigationScreenId}
      eyebrow={org03a.meta?.eyebrow}
      title={drawnTitleOf(org03a)}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
    >
      {/* 나무는 가운데로 모인다. 자리는 design이 정하고 명세는 무엇이 있는지만 말한다. */}
      <div className="flex flex-col items-center">
        <div
          data-node-id={NODE.executives}
          className="w-full max-w-md rounded-md border border-gray-300 bg-white"
        >
          <p className="flex items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.executiveIcon} className="size-4" />
            {executives.title}
          </p>
          <div className="flex flex-wrap gap-3 px-5 pt-4">
            {executiveRows.map((row, index) => (
              <ExecutiveCard
                key={scalar(row, 'id')}
                row={row}
                spec={executiveCard}
                nodeId={index === 0 ? NODE_FIRST.executive : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            data-node-id={NODE.addMember}
            onClick={() => {
              if (addMember.action.type === 'pending') setNote(addMember.action.note)
            }}
            className="flex items-center gap-1 px-5 py-3 text-xs font-medium text-blue-500 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.addMemberIcon} className="size-3" />
            {addMember.label}
          </button>
        </div>

        {/* 회장단에서 부서로 내려가는 줄기(30:4557). 그림이 아니라 선이다. */}
        <span aria-hidden className="h-6 w-px bg-gray-300" />

        <div data-node-id={NODE.departments} className="flex w-full flex-wrap justify-center gap-3">
          {departmentRows.map((row, index) => (
            <DepartmentCard
              key={scalar(row, 'id')}
              row={row}
              first={index === 0}
              nameSpec={nameSpec as SummarySpec}
              leaderList={leaderList as ItemListSpec}
              memberList={memberList as ItemListSpec}
              onNote={setNote}
            />
          ))}
        </div>

        {note === null ? null : (
          <p role="status" className="pt-6 text-xs text-gray-500">
            {note}
          </p>
        )}
      </div>
    </AppShell>
  )
}

// 회장단의 사람 카드. 자리 딱지가 있고, 그 색이 카드까지 물든다.
function ExecutiveCard({
  row,
  spec,
  nodeId,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
}) {
  const tone = spec.status === undefined ? '' : scalar(row, spec.status.toneField)
  return (
    <span
      data-node-id={nodeId}
      className={`flex w-36 flex-col gap-1 rounded-md border p-3 ${
        ROLE_CARD[tone] ?? 'border-gray-200 bg-white'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ROLE_AVATAR[tone] ?? ''} className="size-8" />
      <span className="pt-1 text-xs font-semibold text-gray-800">
        {scalar(row, spec.titleField!)}
      </span>
      {(spec.items ?? []).map((item, index) => (
        <span
          key={item.field}
          className={`text-[11px] font-medium ${index === 0 ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {scalar(row, item.field!)}
        </span>
      ))}
      {spec.status === undefined ? null : (
        <span
          className={`mt-1 w-fit rounded px-2 py-0.5 text-[11px] font-semibold ${ROLE_CHIP[tone] ?? ''}`}
        >
          {scalar(row, spec.status.field)}
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
          // 부서장이 없는 부서에만 그려진다. 명세가 emptyAction으로 말한다.
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
        {/* 제목이 바깥 항목에서 온다(titleField) — '부원 2명'이 글자 하나다. */}
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
      {/* 회장단 카드와 굵기가 다르다 - 저기는 500, 여기는 400이다. */}
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
