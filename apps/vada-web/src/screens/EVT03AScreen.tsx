import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { findDataSource, readListSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { ROLE_CARD, ROLE_CHIP } from '../design/tones'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evt03a } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 운영 조직 — 보기(EVT-03A). 한 행사의 조직도를 읽는 화면이다.
//
// ORG-03A(학생회의 조직도)와 **같은 모양이고 다른 물건이다.** 저기는 학생회가
// 늘 갖는 조직이고 여기는 이 행사에만 있는 조직이다 - 카탈로그가 그 사실을
// event.staffLeaders의 설명에 적어 두었다. 그래서 출처가 다르고, 이 화면은
// 어느 행사인지를 밖에서 받는다(params.eventId).
//
// 나무를 그리는 일은 여전히 명세의 것이 아니다. 명세가 말하는 것은 책임자 하나와
// 부서 여럿이 있다는 것뿐이고, 그 둘을 선으로 잇는 것은 design이 정한다.
//
// **EVT-03C는 화면이 아니라 이 화면의 빈 상태다.** 갈피·머리·상태 줄이 03A와
// 완전히 같고 Main Content 안쪽만 바뀐다 - 오갈 수 있는 두 화면이 아니라
// 데이터가 없을 뿐이다. 그래서 별도 화면이 아니라 출처의 messages.empty와
// itemList.emptyAction으로 접는다("비었으니 채우라고 권하는 자리").
//
// 하위 갈피 줄('운영 조직'·'행사 참가자')은 EVT-04와 나눠 그리는 한 줄이다.
// 고르는 값이 아니라 **옮겨 가는 것**이라 select가 아니라 button 둘이다 -
// 갈피마다 다른 화면이고, 지금 보고 있는 갈피는 누를 것이 없다(FIN-REV-01의
// 요청 정보·품목 검토 줄이 같은 자리다).

const SCREEN = 'EVT-03A'

// 빈 상태의 그림만 EVT-03C가 갖고 있다. 03C는 화면이 아니지만 design 파일은
// 따로 저장돼 있어서, 그 자산 폴더가 곧 이 화면의 '빈 상태 그림' 자리다.
const EMPTY_SCREEN = 'EVT-03C'

const NODE = {
  staffTab: '20:6819',
  participantsTab: '20:6822',
  leaders: '20:6826',
  departments: '20:6847',
} as const

// 되풀이되는 묶음은 **첫 사본의 노드만** 등록한다. 나머지 부서는 같은 틀이다.
const NODE_FIRST = {
  leader: '20:6833',
  department: '20:6851',
  leaderSection: '20:6855',
  leaderCard: '20:6859',
  memberSection: '20:6870',
  memberCard: '20:6875',
} as const

const ASSET = {
  workspaceStatus: { startAt: '20:6805' } as Record<string, string>,
  leaderIcon: '20:6828',
  // 사람 그림은 자리마다 다른 노드로 뽑혀 있지만 내용이 같다(회색 하나).
  member: '20:6860',
  emptyIcon: '20:6503',
  emptyAddIcon: '20:6515',
} as const

// 자리 색이 그림까지 정한다. 어느 톤이 어느 그림인지는 design이 아는 것이라
// 명세가 아니라 화면이 갖는다(ORG-03A와 같은 규칙).
const ROLE_AVATAR: Record<string, string> = {
  yellow: '20:6834',
}

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`EVT-03A의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

// 카탈로그가 optional이라고 적은 조각. 없는 것이 오류가 아니다 -
// 자리 딱지가 없는 책임자가 올 수 있다(event.staffLeaders의 roleLabel).
function optional(row: DataRow, field: string | undefined): string | null {
  if (field === undefined) {
    return null
  }
  const value = row[field]
  return value === undefined || Array.isArray(value) ? null : String(value)
}

function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`EVT-03A의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}

interface EVT03AScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT03AScreen({ screenParams, onNavigate }: EVT03AScreenProps) {
  const [note, setNote] = useState<string | null>(null)

  const missing = (evt03a.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt03a.screenId}
        activeNavigationScreenId={evt03a.activeNavigationScreenId}
        eyebrow={evt03a.meta?.eyebrow}
        title={evt03a.meta?.title ?? evt03a.screenId}
        onNavigate={onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  const buttonAt = (nodeId: string) => elementByNodeId(evt03a, nodeId).spec as ButtonSpec
  const leaders = elementByNodeId(evt03a, NODE.leaders).spec as ItemListSpec
  const departments = elementByNodeId(evt03a, NODE.departments).spec as ItemListSpec

  const leaderRows = readListSource(
    leaders.dataSourceKey,
    resolveParams(leaders.params, { screenParams }),
  )
  const departmentRows = readListSource(
    departments.dataSourceKey,
    resolveParams(departments.params, { screenParams }),
  )

  const leaderCard = leaders.itemFields![0].spec as SummarySpec
  const [nameSpec, leaderList, memberList] = departments.itemFields!.map((entry) => entry.spec)

  // 나무가 아예 없는 때가 EVT-03C다. 책임자는 나무의 뿌리이므로 부서도 책임자도
  // 없으면 뿌리만 남겨 두지 않고 자리 전체를 빈 상태에 내준다.
  const configured = leaderRows.length > 0 || departmentRows.length > 0

  return (
    <AppShell
      screenId={evt03a.screenId}
      activeNavigationScreenId={evt03a.activeNavigationScreenId}
      eyebrow={evt03a.meta?.eyebrow}
      title={drawnTitleOf(evt03a, screenParams)}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evt03a}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />

      {/* 인원 관리 안에서 다시 둘로 갈린다 — 작업 공간의 갈피보다 한 층 안쪽이다.
          갈피마다 다른 화면이므로 고르는 것이 아니라 옮겨 가는 것이다. */}
      <div className="-mx-8 flex gap-2 border-b border-gray-200 px-8 pt-6">
        {([NODE.staffTab, NODE.participantsTab] as const).map((nodeId) => {
          const spec = buttonAt(nodeId)
          const here = spec.initiallyDisabled
          return (
            <button
              key={nodeId}
              type="button"
              data-node-id={nodeId}
              disabled={here}
              aria-current={here ? 'page' : undefined}
              onClick={() => {
                if (spec.action.type === 'navigate') {
                  onNavigate(
                    spec.action.targetScreenId,
                    resolveParams(spec.action.params, { screenParams }),
                  )
                }
              }}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium ${
                here
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {spec.label}
            </button>
          )
        })}
      </div>

      {note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      {configured ? (
        // 나무는 가운데로 모인다. 자리는 design이 정하고 명세는 무엇이 있는지만 말한다.
        <div className="flex flex-col items-center pt-6">
          <div
            data-node-id={NODE.leaders}
            className="w-44 rounded-md border border-gray-300 bg-white"
          >
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

          {/* 책임자에서 부서로 내려가는 줄기(20:6846). 그림이 아니라 선이다. */}
          <span aria-hidden className="h-6 w-px bg-gray-400" />

          <div
            data-node-id={NODE.departments}
            className="flex w-full flex-wrap justify-center gap-3"
          >
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
        </div>
      ) : (
        // 비었다는 것을 말하는 것은 출처(messages.empty)이고, 비었으니 채우라고
        // 권하는 것은 명세(emptyAction)다. 화면은 둘을 그리기만 한다.
        //
        // design(EVT-03C 20:6512)은 그 아래에 설명 한 문단을 더 그렸다. 그 글이
        // 앉을 자리가 명세에도 카탈로그에도 없어 여기서는 그리지 않는다 -
        // 화면이 지어내면 아무도 그것이 명세 밖의 카피인 줄 모른다.
        <div
          data-design-state="empty"
          className="flex flex-col items-center gap-4 py-20 text-center"
        >
          <FigmaAsset screenId={EMPTY_SCREEN} nodeId={ASSET.emptyIcon} className="size-12" />
          <p className="text-base font-bold text-gray-900">
            {findDataSource(departments.dataSourceKey).messages.empty}
          </p>
          <button
            type="button"
            onClick={() => {
              if (departments.emptyAction?.type === 'pending') {
                setNote(departments.emptyAction.note)
              }
            }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset
              screenId={EMPTY_SCREEN}
              nodeId={ASSET.emptyAddIcon}
              className="size-3.5"
            />
            {departments.emptyAction?.label}
          </button>
        </div>
      )}
    </AppShell>
  )
}

// 책임자 카드. 자리 딱지가 있고, 그 색이 카드와 사람 그림까지 물든다.
//
// **자리 이름을 화면이 들지 않는다.** '책임자'는 데이터가 주는 값이다
// (event.staffLeaders.roleLabel — 카탈로그가 "명세가 들지 않는다"고 적어 두었다).
function LeaderCard({
  row,
  spec,
  nodeId,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
}) {
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
      <FigmaAsset
        screenId={SCREEN}
        nodeId={ROLE_AVATAR[tone] ?? ASSET.member}
        className="size-8"
      />
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
      {roleLabel === null ? null : (
        <span
          className={`mt-1 w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold ${
            ROLE_CHIP[tone] ?? ''
          }`}
        >
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
    <div className="w-52 rounded-md border border-gray-200 bg-white">
      <p
        data-node-id={at(NODE_FIRST.department)}
        className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-800"
      >
        {scalar(row, nameSpec.titleField!)}
      </p>

      <div data-node-id={at(NODE_FIRST.leaderSection)} className="px-3 pt-3">
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

      <div data-node-id={at(NODE_FIRST.memberSection)} className="px-3 pt-3 pb-3">
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
      className={`mt-2 flex flex-col gap-0.5 rounded border bg-white p-2.5 ${
        accent ? 'border-blue-300' : 'border-gray-200'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.member} className="size-8" />
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
