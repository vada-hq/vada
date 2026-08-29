import { useState } from 'react'
import { evaluateButtonExecution } from '../../../../packages/contracts/src/button-execution.mjs'
import { AppShell } from '../components/AppShell'
import { Field } from '../components/Field'
import { FigmaAsset } from '../components/FigmaAsset'
import { SearchSelect } from '../components/SearchSelect'
import { TextInput } from '../components/TextInput'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { readListSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { ROLE_CARD, ROLE_CHIP, STATE_TEXT } from '../design/tones'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evt03b } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type {
  ButtonSpec,
  InputSpec,
  ItemListSpec,
  SelectSpec,
  SubmitAction,
  SummarySpec,
} from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// 운영 조직 — 수정(EVT-03B). EVT-03A가 읽는 나무를 고치는 화면이다.
//
// ORG-03B(학생회 조직도 수정)와 같은 모양이고 다른 물건이다 - 저기는 학생회가
// 늘 갖는 조직이고 여기는 이 행사에만 있는 조직이라 어느 행사인지를 밖에서
// 받는다. 그리고 **기본 학생회 조직에는 영향을 주지 않는다**(mutations.json의
// event.staff.save가 그렇게 적어 두었다).
//
// 옮기는 몸짓이 ORG-03B와 다르다. 저기는 끌어다 놓기였고 여기는 오른쪽 기둥의
// 안내가 스스로 말한다 - '각 부서 카드의 "＋ 구성원 추가"로 배정'. 명세는 어느
// 목록끼리 오갈 수 있는지(itemMove.poolSourceKey)와 자리를 잃은 사람이 어디에
// 모이는지만 말하고, 몸짓은 design이 정한다.
//
// 고치는 것은 전부 초안에 쌓이고 완료를 눌러야 실제로 바뀐다(stateScopeKey).

const SCREEN = 'EVT-03B'
const SEPARATOR = '\n'

const NODE = {
  cancel: '20:7061',
  done: '20:7063',
  editBasics: '20:7108',
  startEvent: '20:7110',
  staffTab: '20:7116',
  participantsTab: '20:7119',
  leader: '20:7122',
  newDepartment: '20:7129',
  addDepartment: '20:7135',
  leaderCard: '20:7141',
  changeLeader: '20:7165',
  departments: '20:7171',
  panelHead: '20:7297',
  panelList: '20:7302',
} as const

// 되풀이되는 묶음은 **첫 사본의 노드만** 등록한다.
const NODE_FIRST = {
  leaderPerson: '20:7149',
  departmentHead: '20:7175',
  departmentLeader: '20:7184',
  memberSection: '20:7192',
  memberCard: '20:7196',
  addMember: '20:7214',
  panelCard: '20:7303',
} as const

const ASSET = {
  workspaceStatus: { startAt: '20:7098' } as Record<string, string>,
  leaderChevron: '20:7127',
  addDepartmentIcon: '20:7136',
  leaderCardIcon: '20:7143',
  leaderAvatar: '20:7150',
  leaderRelease: '20:7162',
  changeLeaderIcon: '20:7166',
  panelAvatar: '20:7304',
} as const

// **부서마다 그림이 따로 뽑혔다.** 같은 아이콘인데 좌표가 소수점 한 자리씩
// 달라 대조가 서로 다른 그림으로 본다(20:7202는 10.2917, 20:7249는 10.2916).
// 그러므로 부서 차례대로 제 그림을 그려야 한 벌도 빠지지 않는다.
const DEPARTMENT_ART = [
  { menu: '20:7178', chevron: '20:7190', release: '20:7202', addChevron: '20:7216' },
  { menu: '20:7225', chevron: '20:7237', release: '20:7249', addChevron: '20:7254' },
  { menu: '20:7263', chevron: '20:7275', release: '20:7288', addChevron: '20:7293' },
] as const

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`EVT-03B의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

// 카탈로그가 optional이라고 적은 조각. 없는 것이 오류가 아니다.
function optional(row: DataRow, field: string | undefined): string | null {
  if (field === undefined) return null
  const value = row[field]
  return value === undefined || Array.isArray(value) ? null : String(value)
}

function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`EVT-03B의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}

/** 자리 이름. 초안은 자리마다 그 자리에 있는 사람의 id를 담는다. */
const HQ = 'leaders'
const POOL = 'unassigned'

interface EVT03BScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리. 고치던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  /** 명세가 onSuccess.scopeEvent를 말하면 보낸 뒤 그 스코프를 비운다. */
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT03BScreen({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: EVT03BScreenProps) {
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()

  const missing = (evt03b.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt03b.screenId}
        activeNavigationScreenId={evt03b.activeNavigationScreenId}
        eyebrow={evt03b.meta?.eyebrow}
        title={evt03b.meta?.title ?? evt03b.screenId}
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

  const buttonAt = (nodeId: string) => elementByNodeId(evt03b, nodeId).spec as ButtonSpec
  const cancel = buttonAt(NODE.cancel)
  const done = buttonAt(NODE.done)
  const changeLeader = buttonAt(NODE.changeLeader)
  const addDepartment = buttonAt(NODE.addDepartment)
  const leader = elementByNodeId(evt03b, NODE.leader).spec as SelectSpec
  const newDepartment = elementByNodeId(evt03b, NODE.newDepartment).spec as InputSpec
  const leaderCard = elementByNodeId(evt03b, NODE.leaderCard).spec as ItemListSpec
  const departments = elementByNodeId(evt03b, NODE.departments).spec as ItemListSpec
  const panelHead = elementByNodeId(evt03b, NODE.panelHead).spec as SummarySpec
  const panelList = elementByNodeId(evt03b, NODE.panelList).spec as ItemListSpec

  // 고칠 것이 있는 목록은 모은 값의 이름을 갖는다(itemList.fieldKey). 없으면 그
  // 값들을 아무도 가리킬 수 없다.
  const listKey = departments.fieldKey
  if (listKey === undefined) {
    throw new Error('EVT-03B의 부서 목록에 fieldKey가 없습니다. 고친 값을 담을 이름이 없습니다.')
  }

  const argument = resolveParams(leaderCard.params, { screenParams })
  const leaderRows = readListSource(leaderCard.dataSourceKey, argument)
  const departmentRows = readListSource(
    departments.dataSourceKey,
    resolveParams(departments.params, { screenParams }),
  )
  const pooledRows = readListSource(
    panelList.dataSourceKey,
    resolveParams(panelList.params, { screenParams }),
  )

  // 사람은 어느 자리에 있든 같은 사람이다. id로 한 번만 모은다.
  const people = new Map<string, DataRow>()
  for (const row of [...leaderRows, ...pooledRows]) people.set(scalar(row, 'id'), row)
  for (const row of departmentRows) {
    for (const person of rowsOf(row, 'members')) people.set(scalar(person, 'id'), person)
  }

  // 서버가 준 자리. 초안이 비었으면 이것이 시작점이다.
  const memberKey = (departmentId: string) => `${listKey}.${departmentId}.members`
  const fieldKeyOf = (departmentId: string, fieldKey: string) =>
    `${listKey}.${departmentId}.${fieldKey}`

  const seeded: Record<string, string | null> = {
    [HQ]: leaderRows.map((row) => scalar(row, 'id')).join(SEPARATOR),
    [POOL]: pooledRows.map((row) => scalar(row, 'id')).join(SEPARATOR),
  }
  for (const row of departmentRows) {
    seeded[memberKey(scalar(row, 'id'))] = rowsOf(row, 'members')
      .map((person) => scalar(person, 'id'))
      .join(SEPARATOR)
  }

  // 아직 아무것도 옮기지 않았으면 읽어 온 것이 보이고, 한 번이라도 옮기면 그
  // 뒤로는 초안이 답한다(FIN-REQ-01·ORG-03B와 같은 규칙).
  const values: Record<string, string | null> =
    draft.values[HQ] === undefined ? { ...seeded, ...draft.values } : draft.values

  const idsAt = (holder: string): string[] => {
    const raw = values[holder] ?? ''
    return raw === '' ? [] : raw.split(SEPARATOR)
  }

  function write(next: Record<string, string | null>, labels?: Record<string, string>) {
    onChangeDraft({
      values: { ...values, ...next },
      labels: labels === undefined ? draft.labels : { ...draft.labels, ...labels },
    })
  }

  /** 옮기기. 한 사람은 한 자리에만 있으므로 모든 자리에서 빼고 목적지에 넣는다. */
  function move(personId: string, to: string) {
    const holders = [HQ, POOL, ...departmentRows.map((row) => memberKey(scalar(row, 'id')))]
    const next: Record<string, string | null> = {}
    for (const holder of holders) {
      const kept = idsAt(holder).filter((id) => id !== personId)
      next[holder] = (holder === to ? [...kept, personId] : kept).join(SEPARATOR)
    }
    write(next)
  }

  function pressDone() {
    if (done.action.type !== 'submit') return
    const result = evaluateButtonExecution({
      action: done.action,
      elements: evt03b.elements,
      values,
    })
    if (!result.allowed) {
      setBlockedKeys(result.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    void submitAction.run(done.action as SubmitAction, {
      payload: values,
      onNavigate,
      // 무엇을 넘길지는 명세가 말한다(onSuccess.params).
      paramSources: { screenParams },
      onScopeEvent,
    })
  }

  // **갈 곳이 생기면 가야 한다.** 이 함수가 pending만 보던 동안 '기본정보 수정'은
  // 명세가 EVT-02B로 가라고 말한 뒤에도 안내만 내놓고 있었다 — 명세와 화면이
  // 갈린 것을 정규식 검사가 못 잡았다(원문에 그 이름이 없었으니 당연하다).
  const pressPending = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
      return
    }
    if (spec.action.type === 'navigate' && 'targetScreenId' in spec.action) {
      onNavigate(
        spec.action.targetScreenId,
        resolveParams(spec.action.params, { screenParams }),
      )
    }
  }

  // 취소는 제출이 아니라 이동이다. 그래도 초안은 끝나야 하므로 명세가 떠나면서
  // 낼 이벤트를 적어 둔다(action.scopeEvent). 적히지 않았으면 초안은 남는다.
  function pressCancel() {
    if (cancel.action.type !== 'navigate') return
    if (cancel.action.scopeEvent !== undefined) {
      onScopeEvent(evt03b.stateScopeKey ?? '', cancel.action.scopeEvent)
    }
    onNavigate(
      cancel.action.targetScreenId,
      resolveParams(cancel.action.params, { screenParams }),
    )
  }

  const leaderValue = values[leader.fieldKey]
  const [headSpec, deptLeader, memberList, addMember] = departments.itemFields!.map(
    (entry) => entry.spec,
  )

  return (
    <AppShell
      screenId={evt03b.screenId}
      activeNavigationScreenId={evt03b.activeNavigationScreenId}
      eyebrow={evt03b.meta?.eyebrow}
      title={drawnTitleOf(evt03b, screenParams)}
      onNavigate={onNavigate}
      headerAction={
        <span className="flex items-center gap-2">
          <button
            type="button"
            data-node-id={NODE.cancel}
            onClick={pressCancel}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {cancel.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.done}
            onClick={pressDone}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {submitAction.labelOf(done.action as SubmitAction, done.label)}
          </button>
        </span>
      }
    >
      <WorkspaceHeader
        screen={evt03b}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
        actions={
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              data-node-id={NODE.editBasics}
              onClick={pressPending(buttonAt(NODE.editBasics))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {buttonAt(NODE.editBasics).label}
            </button>
            <button
              type="button"
              data-node-id={NODE.startEvent}
              onClick={pressPending(buttonAt(NODE.startEvent))}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {buttonAt(NODE.startEvent).label}
            </button>
          </div>
        }
      />

      {/* 인원 관리 안에서 다시 둘로 갈린다 — 갈피마다 다른 화면이므로 고르는
          것이 아니라 옮겨 가는 것이다. */}
      <div className="-mx-8 flex gap-2 border-b border-gray-200 px-8 pt-6">
        {([NODE.staffTab, NODE.participantsTab] as const).map((nodeId) => {
          const spec = buttonAt(nodeId)
          // 지금 이 화면인지는 명세가 말한다. 눌러도 안 된다는 것과 다른 사실이다.
          const here = spec.action.type === 'current'
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

      <div className="flex gap-6 pt-6">
        <div className="min-w-0 flex-1">
          <div className="w-72">
            <Field
              htmlFor={leader.fieldKey}
              nodeId={NODE.leader}
              label={leader.label}
              required={leader.required}
              error={blockedKeys.includes(leader.fieldKey) ? '필수 항목입니다' : undefined}
            >
              <SearchSelect
                id={leader.fieldKey}
                placeholder={leader.placeholder}
                searchable={leader.searchable}
                disabled={leader.initiallyDisabled}
                hasError={blockedKeys.includes(leader.fieldKey)}
                sourceKey={leader.optionsSource.key}
                sourceParams={resolveParams(leader.optionsSource.params, { screenParams })}
                value={
                  typeof leaderValue !== 'string' || leaderValue === ''
                    ? null
                    : { value: leaderValue, label: draft.labels[leader.fieldKey] ?? leaderValue }
                }
                onSelect={(option) =>
                  write({ [leader.fieldKey]: option.value }, { [leader.fieldKey]: option.label })
                }
                chevron={
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={ASSET.leaderChevron}
                    className="size-3.5"
                  />
                }
              />
            </Field>
          </div>

          {/* 부서 추가. 이름을 적는 칸과 더하는 단추가 한 줄이다. */}
          <div className="w-96 pt-4">
            <Field
              htmlFor={newDepartment.fieldKey}
              nodeId={NODE.newDepartment}
              label={newDepartment.label}
              required={newDepartment.required}
            >
              <div className="flex items-center gap-2">
                <TextInput
                  id={newDepartment.fieldKey}
                  value={values[newDepartment.fieldKey] ?? ''}
                  placeholder={newDepartment.placeholder}
                  type={newDepartment.inputType}
                  onChange={(next) => write({ [newDepartment.fieldKey]: next })}
                />
                <button
                  type="button"
                  data-node-id={NODE.addDepartment}
                  onClick={pressPending(addDepartment)}
                  className="flex shrink-0 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={ASSET.addDepartmentIcon}
                    className="size-3"
                  />
                  {addDepartment.label}
                </button>
              </div>
            </Field>
          </div>

          {/* 나무는 가운데로 모인다. 자리는 design이 정하고 명세는 무엇이 있는지만 말한다. */}
          <div className="flex flex-col items-center pt-6">
            <div
              data-node-id={NODE.leaderCard}
              className="w-48 rounded-md border border-gray-300 bg-white"
            >
              <p className="flex items-center gap-1.5 rounded-t-md border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.leaderCardIcon}
                  className="size-3.5"
                />
                {leaderCard.title}
              </p>
              <div className="p-3">
                {idsAt(HQ).map((id, index) => (
                  <LeaderPerson
                    key={id}
                    row={people.get(id)!}
                    spec={leaderCard.itemFields![0].spec as SummarySpec}
                    nodeId={index === 0 ? NODE_FIRST.leaderPerson : undefined}
                    releaseLabel={leaderCard.itemMove!.releaseLabel}
                    onRelease={() => move(id, POOL)}
                  />
                ))}
                <button
                  type="button"
                  data-node-id={NODE.changeLeader}
                  onClick={pressPending(changeLeader)}
                  className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={ASSET.changeLeaderIcon}
                    className="size-2.5"
                  />
                  {changeLeader.label}
                </button>
              </div>
            </div>

            {/* 책임자에서 부서로 내려가는 줄기(20:7170). 그림이 아니라 선이다. */}
            <span aria-hidden className="h-6 w-px bg-gray-400" />

            <div
              data-node-id={NODE.departments}
              className="flex w-full flex-wrap items-start justify-center gap-3"
            >
              {departmentRows.map((row, index) => {
                const departmentId = scalar(row, 'id')
                const art = DEPARTMENT_ART[Math.min(index, DEPARTMENT_ART.length - 1)]
                const at = (nodeId: string) => (index === 0 ? nodeId : undefined)
                const selectValue = (spec: SelectSpec) => {
                  const key = fieldKeyOf(departmentId, spec.fieldKey)
                  const stored = values[key]
                  return typeof stored !== 'string' || stored === ''
                    ? null
                    : { value: stored, label: draft.labels[key] ?? stored }
                }
                return (
                  <div
                    key={departmentId}
                    className="w-56 rounded-md border border-gray-200 bg-white"
                  >
                    <p
                      data-node-id={at(NODE_FIRST.departmentHead)}
                      className="flex items-center border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-800"
                    >
                      <span>{scalar(row, (headSpec as SummarySpec).titleField!)}</span>
                      <button
                        type="button"
                        aria-label={`${scalar(row, 'name')} ${
                          (headSpec as SummarySpec).action?.label ?? ''
                        }`}
                        onClick={() => {
                          const action = (headSpec as SummarySpec).action
                          if (action?.type === 'pending') setNote(action.note)
                        }}
                        className="ml-auto focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                      >
                        <FigmaAsset screenId={SCREEN} nodeId={art.menu} className="size-4" />
                      </button>
                    </p>

                    {/* 부서장은 카드가 아니라 고르는 칸이다 — design이 빈 드롭다운으로
                        그렸으므로 지금 부서장을 되비추지 않는다. */}
                    <div data-node-id={at(NODE_FIRST.departmentLeader)} className="px-3 pt-3">
                      <label
                        htmlFor={fieldKeyOf(departmentId, (deptLeader as SelectSpec).fieldKey)}
                        className="text-xs text-gray-400"
                      >
                        {(deptLeader as SelectSpec).label}
                      </label>
                      <div className="pt-1.5">
                        <DepartmentSelect
                          spec={deptLeader as SelectSpec}
                          id={fieldKeyOf(departmentId, (deptLeader as SelectSpec).fieldKey)}
                          departmentId={departmentId}
                          screenParams={screenParams}
                          chevronNodeId={art.chevron}
                          value={selectValue(deptLeader as SelectSpec)}
                          onSelect={(option) =>
                            write(
                              {
                                [fieldKeyOf(
                                  departmentId,
                                  (deptLeader as SelectSpec).fieldKey,
                                )]: option.value,
                              },
                              {
                                [fieldKeyOf(
                                  departmentId,
                                  (deptLeader as SelectSpec).fieldKey,
                                )]: option.label,
                              },
                            )
                          }
                        />
                      </div>
                    </div>

                    <div data-node-id={at(NODE_FIRST.memberSection)} className="px-3 pt-3">
                      {/* 제목이 바깥 항목에서 온다(titleField) — '부원 2명'이 글자 하나다. */}
                      <p className="text-xs text-gray-400">
                        {scalar(row, (memberList as ItemListSpec).titleField!)}
                      </p>
                      {idsAt(memberKey(departmentId)).map((personId, at2) => (
                        <MemberRow
                          key={personId}
                          row={people.get(personId)!}
                          spec={(memberList as ItemListSpec).itemFields![0].spec as SummarySpec}
                          nodeId={at2 === 0 ? at(NODE_FIRST.memberCard) : undefined}
                          releaseLabel={(memberList as ItemListSpec).itemMove!.releaseLabel}
                          releaseNodeId={art.release}
                          onRelease={() => move(personId, POOL)}
                        />
                      ))}
                    </div>

                    {/* 사람을 부서로 보내는 자리. 오른쪽 기둥의 안내가 이것을 가리킨다.
                        design이 라벨을 그리지 않았지만 읽어 주는 이름은 있어야 한다
                        (select.labelHidden). */}
                    <div data-node-id={at(NODE_FIRST.addMember)} className="px-3 pt-3 pb-3">
                      <label
                        htmlFor={fieldKeyOf(departmentId, (addMember as SelectSpec).fieldKey)}
                        className="sr-only"
                      >
                        {(addMember as SelectSpec).label}
                      </label>
                      <DepartmentSelect
                        spec={addMember as SelectSpec}
                        id={fieldKeyOf(departmentId, (addMember as SelectSpec).fieldKey)}
                        departmentId={departmentId}
                        screenParams={screenParams}
                        chevronNodeId={art.addChevron}
                        value={selectValue(addMember as SelectSpec)}
                        onSelect={(option) => {
                          write(
                            {
                              [fieldKeyOf(
                                departmentId,
                                (addMember as SelectSpec).fieldKey,
                              )]: option.value,
                            },
                            {
                              [fieldKeyOf(
                                departmentId,
                                (addMember as SelectSpec).fieldKey,
                              )]: option.label,
                            },
                          )
                          move(option.value, memberKey(departmentId))
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {note === null ? null : (
            <p role="status" className="pt-6 text-xs font-medium text-gray-500">
              {note}
            </p>
          )}
          {submitAction.errorMessage === null ? null : (
            <p role="alert" className="pt-6 text-xs text-red-500">
              {submitAction.errorMessage}
            </p>
          )}
        </div>

        {/* 기본 조직 구성원. 자리를 잃은 사람이 모이는 곳이다. */}
        <aside
          aria-label={panelHead.title}
          className="w-56 shrink-0 rounded-md border border-gray-200 bg-white"
        >
          <div data-node-id={NODE.panelHead} className="border-b border-gray-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-gray-800">{panelHead.title}</p>
            <p className="pt-1 text-xs text-gray-400">{panelHead.description}</p>
          </div>
          <div data-node-id={NODE.panelList} className="flex flex-col gap-3 p-3">
            {idsAt(POOL).map((id, index) => (
              <PanelCard
                key={id}
                row={people.get(id)!}
                spec={panelList.itemFields![0].spec as SummarySpec}
                nodeId={index === 0 ? NODE_FIRST.panelCard : undefined}
              />
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  )
}

/** 부서 카드 안의 고르는 칸. 어느 부서인지가 조회 인자로 들어간다(itemField). */
function DepartmentSelect({
  spec,
  id,
  departmentId,
  screenParams,
  chevronNodeId,
  value,
  onSelect,
}: {
  spec: SelectSpec
  id: string
  departmentId: string
  screenParams: Record<string, string>
  chevronNodeId: string
  value: { value: string; label: string } | null
  onSelect: (option: { value: string; label: string }) => void
}) {
  return (
    <SearchSelect
      id={id}
      placeholder={spec.placeholder}
      searchable={spec.searchable}
      disabled={spec.initiallyDisabled}
      sourceKey={spec.optionsSource.key}
      sourceParams={resolveParams(spec.optionsSource.params, {
        screenParams,
        row: { id: departmentId },
      })}
      value={value}
      onSelect={onSelect}
      chevron={<FigmaAsset screenId={SCREEN} nodeId={chevronNodeId} className="size-2.5" />}
    />
  )
}

// 책임자 카드. 자리 딱지가 있고 그 색이 카드까지 물든다.
// **자리 이름을 화면이 들지 않는다** — 데이터가 주는 값이다(roleLabel).
function LeaderPerson({
  row,
  spec,
  nodeId,
  releaseLabel,
  onRelease,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
  releaseLabel: string
  onRelease: () => void
}) {
  const status = spec.status?.[0]
  const tone = optional(row, status?.toneField) ?? ''
  const roleLabel = optional(row, status?.field)
  return (
    <span
      data-node-id={nodeId}
      className={`relative flex flex-col gap-0.5 rounded border p-2.5 ${
        ROLE_CARD[tone] ?? 'border-gray-200 bg-white'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.leaderAvatar} className="size-6" />
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
      {/* 자리에서 빼기. 글이 없고 동그란 표시 하나뿐이라 이름은 보조기기만 읽는다. */}
      <button
        type="button"
        aria-label={`${scalar(row, spec.titleField!)} ${releaseLabel}`}
        onClick={onRelease}
        className="absolute -top-2 -right-2 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.leaderRelease} className="size-3.5" />
      </button>
    </span>
  )
}

// 부서의 부원 한 줄. 이름 뒤에 자리 딱지가 붙는 사람이 있다(부서장을 겸하는 부원).
function MemberRow({
  row,
  spec,
  nodeId,
  releaseLabel,
  releaseNodeId,
  onRelease,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
  releaseLabel: string
  releaseNodeId: string
  onRelease: () => void
}) {
  const status = spec.status?.[0]
  const tone = optional(row, status?.toneField) ?? ''
  const roleLabel = optional(row, status?.field)
  return (
    <span
      data-node-id={nodeId}
      className="mt-2 flex items-center gap-2 rounded border border-gray-200 px-2 py-1.5"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-gray-800">
          <span>{scalar(row, spec.titleField!)}</span>
          {roleLabel === null ? null : (
            <span className={STATE_TEXT[tone] ?? ''}>{roleLabel}</span>
          )}
        </span>
        {/* design은 학부와 학년을 한 줄기로 그린다(20:7201). 조각을 잇는 방법은
            명세가 아니라 design이 정한다. */}
        <span className="block text-[11px] text-gray-400">
          {(spec.items ?? []).map((item) => scalar(row, item.field!)).join(' · ')}
        </span>
      </span>
      <button
        type="button"
        aria-label={`${scalar(row, spec.titleField!)} ${releaseLabel}`}
        onClick={onRelease}
        className="shrink-0 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={SCREEN} nodeId={releaseNodeId} className="size-3" />
      </button>
    </span>
  )
}

function PanelCard({
  row,
  spec,
  nodeId,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
}) {
  return (
    <span
      data-node-id={nodeId}
      className="flex w-24 flex-col gap-0.5 rounded border border-gray-200 bg-white p-2.5"
    >
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.panelAvatar} className="size-6" />
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
