import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { ROLE_CARD, ROLE_CHIP } from '../design/tones'
import { drawnTitleOf, elementByNodeId, org03b } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type {
  ButtonSpec,
  InputSpec,
  ItemListSpec,
  SubmitAction,
  SummarySpec,
} from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// 조직 관리 — 수정(ORG-03B). ORG-03A와 같은 나무를 고치는 화면이다.
//
// 여기서 처음인 것은 **사람이 자리를 옮기는 것**이다. 한 사람은 정확히 한 자리에
// 있고(회장단·어느 부서의 부서장·그 부서의 부원·미배정), 옮기면 저쪽에서 사라지고
// 이쪽에 생긴다. 어느 자리끼리 오갈 수 있는지는 명세가 말한다 —
// **같은 poolSourceKey를 가리키는 목록끼리**가 한 무리다(itemMove).
//
// **끌어다 놓는 것은 design이 정한 것이다.** 명세는 옮길 수 있다는 사실과 자리를
// 잃은 사람이 어디 모이는가만 말한다. 그래서 여기서 끌기를 붙이는 것은 화면의
// 일이고, 자리에서 빼는 단추(동그란 빼기 표시)도 같은 '옮기기'다 — 가는 곳이
// 미배정으로 정해져 있을 뿐이다.
//
// 고치는 것은 전부 초안에 쌓이고 완료를 눌러야 실제로 바뀐다(stateScopeKey).

const SCREEN = 'ORG-03B'
const SEPARATOR = '\n'

const NODE = {
  breadcrumb: '30:4758',
  invite: '30:4769',
  done: '30:4776',
  executives: '30:4781',
  editExecutives: '30:4788',
  addExecutive: '30:4842',
  departments: '30:4848',
  addDepartment: '30:5079',
  panelHead: '30:5088',
  search: '30:5095',
  panelList: '30:5101',
} as const

// 되풀이되는 묶음은 첫 사본의 노드만 등록한다.
const NODE_FIRST = {
  executiveCard: '30:4792',
  departmentHead: '30:4852',
  leaderSection: '30:4861',
  leaderCard: '30:4865',
  memberSection: '30:4886',
  memberCard: '30:4891',
  panelCard: '30:5104',
} as const

const ASSET = {
  breadcrumbSeparator: '30:4762',
  inviteIcon: '30:4770',
  executiveIcon: '30:4784',
  addExecutiveIcon: '30:4843',
  searchIcon: '30:5096',
  deleteIcon: '30:5124',
  departmentMenu: '30:4855',
  addDepartmentIcon: '30:5082',
} as const

// 카드마다 그림이 셋이다: 얼굴·끌기 손잡이·빼기 단추. 자리마다 바탕색이 달라
// 얼굴 그림도 갈리므로(ORG-03A와 같은 규칙) 자리별로 지목한다. 빼기 단추는
// 미배정 카드에만 없다 - 거기서는 옮길 자리가 아니라 지우는 자리가 붙는다.
const CARD_ART = {
  executive: { avatar: '30:4798', grip: '30:4810', release: '30:4793' },
  viceExecutive: { avatar: '30:4823', grip: '30:4835', release: '30:4818' },
  leader: { avatar: '30:4866', grip: '30:4876', release: '30:4883' },
  member: { avatar: '30:4892', grip: '30:4902', release: '30:4909' },
  pooled: { avatar: '30:5105', grip: '30:5115', release: null },
} as const

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`ORG-03B의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`ORG-03B의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}

/** 자리 이름. 초안은 자리마다 그 자리에 있는 사람의 id를 담는다. */
const HQ = 'executives'
const POOL = 'unassigned'
const leaderKey = (departmentId: string) => `${departmentId}.leaders`
const memberKey = (departmentId: string) => `${departmentId}.members`

interface ORG03BScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function ORG03BScreen({
  draft: scopeDraft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: ORG03BScreenProps) {
  const [note, setNote] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const submitAction = useSubmitAction()

  const invite = elementByNodeId(org03b, NODE.invite).spec as ButtonSpec
  const done = elementByNodeId(org03b, NODE.done).spec as ButtonSpec
  const executives = elementByNodeId(org03b, NODE.executives).spec as ItemListSpec
  const editExecutives = elementByNodeId(org03b, NODE.editExecutives).spec as ButtonSpec
  const addExecutive = elementByNodeId(org03b, NODE.addExecutive).spec as ButtonSpec
  const departments = elementByNodeId(org03b, NODE.departments).spec as ItemListSpec
  const addDepartment = elementByNodeId(org03b, NODE.addDepartment).spec as ButtonSpec
  const panelHead = elementByNodeId(org03b, NODE.panelHead).spec as SummarySpec
  const search = elementByNodeId(org03b, NODE.search).spec as InputSpec
  const panelList = elementByNodeId(org03b, NODE.panelList).spec as ItemListSpec

  // 서버가 준 자리. 초안이 비었으면 이것이 시작점이다.
  const executiveRows = readListSource(executives.dataSourceKey)
  const departmentRows = readListSource(departments.dataSourceKey)
  const pooledRows = readListSource(panelList.dataSourceKey)
  const hint = readObjectSource(panelHead.dataSourceKey)

  // 사람은 어느 자리에 있든 같은 사람이다. id로 한 번만 모은다.
  const people = new Map<string, DataRow>()
  for (const row of executiveRows) people.set(scalar(row, 'id'), row)
  for (const row of departmentRows) {
    for (const person of [...rowsOf(row, 'leaders'), ...rowsOf(row, 'members')]) {
      people.set(scalar(person, 'id'), person)
    }
  }
  for (const row of pooledRows) people.set(scalar(row, 'id'), row)

  const seeded: Record<string, string> = {
    [HQ]: executiveRows.map((row) => scalar(row, 'id')).join(SEPARATOR),
    [POOL]: pooledRows.map((row) => scalar(row, 'id')).join(SEPARATOR),
  }
  for (const row of departmentRows) {
    const id = scalar(row, 'id')
    seeded[leaderKey(id)] = rowsOf(row, 'leaders').map((p) => scalar(p, 'id')).join(SEPARATOR)
    seeded[memberKey(id)] = rowsOf(row, 'members').map((p) => scalar(p, 'id')).join(SEPARATOR)
  }

  // 아직 아무것도 고치지 않았으면 읽어 온 것이 보이고, 한 번이라도 옮기면
  // 그 뒤로는 초안이 답한다(FIN-REQ-01과 같은 규칙).
  const touched = scopeDraft.values[HQ] !== undefined
  const values = touched ? scopeDraft.values : seeded
  const query = scopeDraft.values[search.fieldKey] ?? ''

  const idsAt = (holder: string): string[] => {
    const raw = values[holder] ?? ''
    return raw === '' ? [] : raw.split(SEPARATOR)
  }

  function writeHolders(next: Record<string, string>) {
    onChangeDraft({
      values: { ...values, ...next, [search.fieldKey]: query },
      labels: scopeDraft.labels,
    })
  }

  /** 옮기기. 한 사람은 한 자리에만 있으므로 모든 자리에서 빼고 목적지에 넣는다. */
  function move(memberId: string, to: string) {
    const next: Record<string, string> = {}
    for (const holder of Object.keys(values)) {
      if (holder === search.fieldKey) continue
      const kept = idsAt(holder).filter((id) => id !== memberId)
      next[holder] = kept.join(SEPARATOR)
    }
    next[to] = [...(next[to] === '' ? [] : next[to].split(SEPARATOR)), memberId].join(SEPARATOR)
    writeHolders(next)
    setDragging(null)
  }

  /** 지우기. 옮기기와 다르다 — 조직에서 아주 없앤다. */
  function removeMember(memberId: string) {
    writeHolders({ [POOL]: idsAt(POOL).filter((id) => id !== memberId).join(SEPARATOR) })
  }

  function setQuery(next: string) {
    onChangeDraft({ values: { ...values, [search.fieldKey]: next }, labels: scopeDraft.labels })
  }

  // 거르는 일을 여기서 한다. 보통은 출처가 걸러야 하지만(받아온 것을 화면에서
  // 거르면 명세의 params와 다른 것을 구현하게 된다) **이 목록은 서버의 것이 아니라
  // 초안이다** - 방금 부서에서 뺀 사람은 서버의 미배정 목록에 없으므로, 출처에
  // 물으면 옮기자마자 사라진다(실제로 그렇게 사라졌다).
  //
  // design이 '이름 검색'이라 적었으므로 보는 것은 이름 하나다.
  const pooledIds = idsAt(POOL).filter((id) => {
    const person = people.get(id)
    if (person === undefined) return false
    return query.trim() === '' || scalar(person, 'name').includes(query.trim())
  })

  const executiveCard = executives.itemFields![0].spec as SummarySpec
  const [headSpec, leaderList, memberList] = departments.itemFields!.map((entry) => entry.spec)
  const breadcrumb = org03b.breadcrumb

  const pressPending = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }

  function pressDone() {
    void submitAction.run(done.action as SubmitAction, {
      payload: values,
      onNavigate,
      onScopeEvent,
    })
  }

  // 자리에 놓을 수 있게 하는 배선. 어느 자리든 규칙이 같다.
  const dropTarget = (holder: string) => ({
    onDragOver: (event: React.DragEvent) => {
      if (dragging !== null) event.preventDefault()
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      const memberId = event.dataTransfer.getData('text/plain') || dragging
      if (memberId !== null && memberId !== '') move(memberId, holder)
    },
  })

  return (
    <AppShell
      screenId={org03b.screenId}
      activeNavigationScreenId={org03b.activeNavigationScreenId}
      eyebrow={org03b.meta?.eyebrow}
      title={drawnTitleOf(org03b)}
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
      headerAction={
        <span className="flex items-center gap-2">
          <button
            type="button"
            data-node-id={NODE.invite}
            onClick={pressPending(invite)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.inviteIcon} className="size-4" />
            {invite.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.done}
            onClick={pressDone}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {submitAction.labelOf(done.action as SubmitAction, done.label)}
          </button>
        </span>
      }
    >
      <div className="flex gap-6">
        <div className="flex flex-1 flex-col items-center">
          <div
            data-node-id={NODE.executives}
            className="w-full max-w-md rounded-md border border-gray-300 bg-white"
            {...dropTarget(HQ)}
          >
            <p className="flex items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.executiveIcon} className="size-4" />
              <span>{executives.title}</span>
              <button
                type="button"
                data-node-id={NODE.editExecutives}
                onClick={pressPending(editExecutives)}
                className="ml-auto text-xs font-medium text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
              >
                {editExecutives.label}
              </button>
            </p>
            <div className="flex flex-wrap gap-3 px-5 pt-4">
              {idsAt(HQ).map((id, index) => (
                <PersonCard
                  key={id}
                  row={people.get(id)!}
                  spec={executiveCard}
                  nodeId={index === 0 ? NODE_FIRST.executiveCard : undefined}
                  releaseLabel={executives.itemMove!.releaseLabel}
                  onRelease={() => move(id, POOL)}
                  onDragStart={() => setDragging(id)}
                  variant="executive"
                  art={index === 0 ? CARD_ART.executive : CARD_ART.viceExecutive}
                />
              ))}
            </div>
            <button
              type="button"
              data-node-id={NODE.addExecutive}
              onClick={pressPending(addExecutive)}
              className="flex items-center gap-1 px-5 py-3 text-xs font-medium text-blue-500 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.addExecutiveIcon} className="size-3" />
              {addExecutive.label}
            </button>
          </div>

          <span aria-hidden className="h-6 w-px bg-gray-300" />

          <div
            data-node-id={NODE.departments}
            className="flex w-full flex-wrap items-start justify-center gap-3"
          >
            {departmentRows.map((row, index) => {
              const id = scalar(row, 'id')
              const at = (nodeId: string) => (index === 0 ? nodeId : undefined)
              return (
                <div key={id} className="w-72 rounded-md border border-gray-200 bg-white">
                  <p
                    data-node-id={at(NODE_FIRST.departmentHead)}
                    className="flex items-center border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800"
                  >
                    <span>{scalar(row, (headSpec as SummarySpec).titleField!)}</span>
                    <button
                      type="button"
                      aria-label={`${scalar(row, 'name')} 메뉴`}
                      onClick={() => {
                        const action = (headSpec as SummarySpec).action
                        if (action?.type === 'pending') setNote(action.note)
                      }}
                      className="ml-auto focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                    >
                      <FigmaAsset
                        screenId={SCREEN}
                        nodeId={ASSET.departmentMenu}
                        className="size-4"
                      />
                    </button>
                  </p>

                  <div
                    data-node-id={at(NODE_FIRST.leaderSection)}
                    className="px-5 pt-4"
                    {...dropTarget(leaderKey(id))}
                  >
                    <p className="text-xs text-gray-400">{(leaderList as ItemListSpec).title}</p>
                    {idsAt(leaderKey(id)).length === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const action = (leaderList as ItemListSpec).emptyAction
                          if (action?.type === 'pending') setNote(action.note)
                        }}
                        className="mt-2 rounded border border-dashed border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                      >
                        {(leaderList as ItemListSpec).emptyAction?.label}
                      </button>
                    ) : (
                      idsAt(leaderKey(id)).map((memberId) => (
                        <PersonCard
                          key={memberId}
                          row={people.get(memberId)!}
                          spec={(leaderList as ItemListSpec).itemFields![0].spec as SummarySpec}
                          nodeId={at(NODE_FIRST.leaderCard)}
                          releaseLabel={(leaderList as ItemListSpec).itemMove!.releaseLabel}
                          onRelease={() => move(memberId, POOL)}
                          onDragStart={() => setDragging(memberId)}
                          variant="leader"
                          art={CARD_ART.leader}
                        />
                      ))
                    )}
                  </div>

                  <div
                    data-node-id={at(NODE_FIRST.memberSection)}
                    className="px-5 pt-4 pb-5"
                    {...dropTarget(memberKey(id))}
                  >
                    <p className="text-xs text-gray-400">
                      {scalar(row, (memberList as ItemListSpec).titleField!)}
                    </p>
                    {idsAt(memberKey(id)).map((memberId, at2) => (
                      <PersonCard
                        key={memberId}
                        row={people.get(memberId)!}
                        spec={(memberList as ItemListSpec).itemFields![0].spec as SummarySpec}
                        nodeId={at2 === 0 ? at(NODE_FIRST.memberCard) : undefined}
                        releaseLabel={(memberList as ItemListSpec).itemMove!.releaseLabel}
                        onRelease={() => move(memberId, POOL)}
                        onDragStart={() => setDragging(memberId)}
                        variant="member"
                        art={CARD_ART.member}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              data-node-id={NODE.addDepartment}
              onClick={pressPending(addDepartment)}
              className="flex h-28 w-72 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 text-xs font-medium text-gray-400 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.addDepartmentIcon} className="size-4" />
              {addDepartment.label}
            </button>
          </div>

          {note === null ? null : (
            <p role="status" className="pt-6 text-xs text-gray-500">
              {note}
            </p>
          )}
          {submitAction.errorMessage === null ? null : (
            <p role="alert" className="pt-6 text-xs text-red-500">
              {submitAction.errorMessage}
            </p>
          )}
        </div>

        {/* 미배정 구성원. 자리를 잃은 사람이 모이는 곳이고, 여기서만 아주 지울 수 있다. */}
        <aside className="w-72 shrink-0 rounded-md border border-gray-200 bg-white" {...dropTarget(POOL)}>
          <div data-node-id={NODE.panelHead} className="border-b border-gray-100 px-5 py-4">
            <p className="text-sm font-semibold text-gray-800">{panelHead.title}</p>
            <p className="pt-1 text-xs text-gray-400">
              {String(hint[panelHead.descriptionField!])}
            </p>
          </div>
          <div className="px-5 py-3">
            <label htmlFor={search.fieldKey} className="sr-only">
              {search.label}
            </label>
            {/* design은 돋보기와 입력칸을 한 테두리 안에 함께 담는다(MY-01과 같다). */}
            <span
              data-node-id={NODE.search}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-600/50"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.searchIcon} className="size-4 shrink-0" />
              <input
                id={search.fieldKey}
                type={search.inputType}
                value={query}
                placeholder={search.placeholder ?? search.label}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
            </span>
          </div>
          <div data-node-id={NODE.panelList} className="flex flex-col gap-3 px-5 pb-5">
            {pooledIds.map((id, index) => (
              <div key={id}>
                <PersonCard
                  row={people.get(id)!}
                  spec={panelList.itemFields![0].spec as SummarySpec}
                  nodeId={index === 0 ? NODE_FIRST.panelCard : undefined}
                  onDragStart={() => setDragging(id)}
                  variant="pooled"
                  art={CARD_ART.pooled}
                />
                <button
                  type="button"
                  onClick={() => removeMember(id)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.deleteIcon} className="size-3" />
                  {panelList.itemRemove!.label}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  )
}

interface PersonCardProps {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
  releaseLabel?: string
  onRelease?: () => void
  onDragStart: () => void
  variant: 'executive' | 'leader' | 'member' | 'pooled'
  /** 이 자리의 그림 셋(얼굴·손잡이·빼기). */
  art: { avatar: string; grip: string; release: string | null }
}

function PersonCard({
  row,
  spec,
  nodeId,
  releaseLabel,
  onRelease,
  onDragStart,
  variant,
  art,
}: PersonCardProps) {
  const tone = spec.status === undefined ? '' : scalar(row, spec.status.toneField)
  const frame =
    variant === 'executive'
      ? `w-36 ${ROLE_CARD[tone] ?? 'border-gray-200 bg-white'}`
      : variant === 'leader'
        ? 'border-blue-300 bg-white'
        : 'border-gray-200 bg-white'

  return (
    <span
      data-node-id={nodeId}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', scalar(row, 'id'))
        onDragStart()
      }}
      className={`relative mt-2 flex flex-col gap-0.5 rounded-md border p-3 ${frame}`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={art.grip} className="absolute top-2 left-2 size-3" />
      <FigmaAsset screenId={SCREEN} nodeId={art.avatar} className="size-7" />
      <span className="pt-1 text-xs font-semibold text-gray-800">
        {scalar(row, spec.titleField!)}
      </span>
      {(spec.items ?? []).map((item, index) => (
        <span
          key={item.field}
          className={`text-[11px] ${variant === 'executive' ? 'font-medium ' : ''}${
            index === 0 ? 'text-gray-500' : 'text-gray-400'
          }`}
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
      {/* 자리에서 빼기. 글이 없고 동그란 표시 하나뿐이라 이름은 보조기기만 읽는다. */}
      {releaseLabel === undefined || onRelease === undefined || art.release === null ? null : (
        <button
          type="button"
          aria-label={`${scalar(row, spec.titleField!)} ${releaseLabel}`}
          onClick={onRelease}
          className="absolute -top-2 -right-2 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={art.release} className="size-4" />
        </button>
      )}
    </span>
  )
}
