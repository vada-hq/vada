import { useState } from 'react'
import type { ReactNode } from 'react'
import { evaluateButtonExecution } from '../../../../packages/contracts/src/button-execution.mjs'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { Field } from '../components/Field'
import { FigmaAsset } from '../components/FigmaAsset'
import { PrimaryButton } from '../components/PrimaryButton'
import { SearchSelect } from '../components/SearchSelect'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { SOFT_BOX } from '../design/tones'
import { resolveParams } from '../spec/params'
import { elementByNodeId, evt01 } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type {
  ButtonSpec,
  ItemListSpec,
  SelectSpec,
  SubmitAction,
  SummarySpec,
} from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// 행사 운영 조직 설정(EVT-01). 한 행사의 운영 조직을 **처음 세우는** 화면이다.
//
// ORG-02(학생회 조직 구조 설정)와 같은 모양이고 다른 물건이다 - 저기는 학생회가
// 늘 갖는 조직을 만들고 여기는 이 행사에만 있는 조직을 만든다. 그래서 이 화면은
// 어느 행사인지를 밖에서 받는다(params.eventId).
//
// **셸이 없다.** 겹쳐 뜨는 화면도 아니다 - 이 와이어프레임의 모달은 예외 없이
// 아래 화면(DesktopShell)을 형제로 함께 그리고 30% 검은 막을 깔지만(ORG-07C
// 30:6127), EVT-01의 바깥 프레임은 불투명한 gray-50 한 장이고 안쪽이 화면
// 높이를 넘겨 흐른다(20:6520, 926px > 740px). 카드가 1288 전체의 가운데에
// 놓인 것도 사이드바가 없다는 뜻이다 - 있었다면 210 오른쪽의 1078 안에서
// 가운데였을 것이다.
//
// 방식 셋은 **미리보기를 바꾼다.** 고른 값이 조회 인자로 들어가므로(setupMode)
// 화면이 받아 온 것을 거르지 않는다 - 무엇이 만들어질지는 서버가 안다.

const SCREEN = 'EVT-01'

const NODE = {
  head: '20:6522',
  setupMode: '20:6530',
  leader: '20:6547',
  preview: '20:6554',
  back: '20:6671',
  save: '20:6676',
} as const

// 되풀이되는 묶음은 **첫 사본의 노드만** 등록한다. 나머지 부서는 같은 틀이다.
const NODE_FIRST = {
  department: '20:6559',
  leaderSection: '20:6563',
  leaderCard: '20:6567',
  memberSection: '20:6578',
  memberCard: '20:6583',
} as const

const ASSET = {
  leaderChevron: '20:6552',
  // 사람 그림 여섯이 자리마다 다른 노드로 뽑혔지만 내용이 하나다(대조는 그림으로 묶는다).
  member: '20:6568',
  backArrow: '20:6672',
} as const

// 카드 20:6521은 폭 860이다. 와이어프레임의 0.875배를 풀면 982다(ORG-02와 같다).
const CARD_WIDTH = 982

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`EVT-01의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`EVT-01의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}

interface EVT01ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리. 고르던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  /** 명세가 onSuccess.scopeEvent를 말하면 보낸 뒤 그 스코프를 비운다. */
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT01Screen({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: EVT01ScreenProps) {
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()

  const missing = (evt01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <Card>
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </Card>
    )
  }

  const head = elementByNodeId(evt01, NODE.head).spec as SummarySpec
  const setupMode = elementByNodeId(evt01, NODE.setupMode).spec as SelectSpec
  const leader = elementByNodeId(evt01, NODE.leader).spec as SelectSpec
  const preview = elementByNodeId(evt01, NODE.preview).spec as ItemListSpec
  const back = elementByNodeId(evt01, NODE.back).spec as ButtonSpec
  const save = elementByNodeId(evt01, NODE.save).spec as ButtonSpec

  const eventRow = readObjectSource(
    head.dataSourceKey,
    resolveParams(head.params, { screenParams }),
  )

  // 그리는 값과 판정하는 값은 같아야 한다. 아직 아무도 고르지 않았을 때의 값이
  // initialValue이므로 판정기에도 그것을 넘긴다(ORG-02가 이 자리에서 틀렸었다).
  const values: Record<string, string | null> = { ...draft.values }
  for (const spec of [setupMode, leader]) {
    if (values[spec.fieldKey] === undefined) {
      values[spec.fieldKey] = spec.initialValue
    }
  }

  function setValue(spec: SelectSpec, value: string, label: string) {
    onChangeDraft({
      values: { ...values, [spec.fieldKey]: value },
      labels: { ...draft.labels, [spec.fieldKey]: label },
    })
  }

  const optionOf = (spec: SelectSpec) => {
    const value = values[spec.fieldKey]
    if (typeof value !== 'string' || value === '') {
      return null
    }
    return { value, label: draft.labels[spec.fieldKey] ?? value }
  }

  // 미리보기는 **고른 방식이 조회 인자로 들어간다.** 받아온 것을 화면에서 거르면
  // 명세의 params와 다른 것을 구현하게 된다.
  const previewRows = readListSource(
    preview.dataSourceKey,
    resolveParams(preview.params, { screenParams, fields: values }),
  )

  const [nameSpec, leaderList, memberList] = preview.itemFields!.map((entry) => entry.spec)

  function pressSave() {
    if (save.action.type !== 'submit') return
    const result = evaluateButtonExecution({
      action: save.action,
      elements: evt01.elements,
      values,
    })
    if (!result.allowed) {
      setBlockedKeys(result.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    void submitAction.run(save.action as SubmitAction, {
      payload: values,
      onNavigate,
      // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그 값이 어디
      // 있는지만 알려 준다.
      paramSources: { screenParams },
      onScopeEvent,
    })
  }

  const errorOf = (spec: SelectSpec) =>
    blockedKeys.includes(spec.fieldKey) ? '필수 항목입니다' : undefined

  return (
    <Card>
      {/* 머리. **눈썹이 그 행사의 이름이다** - 고정 글이 아니라 데이터라서
          화면 카피(meta)가 아니라 요소로 등록한다(summary.eyebrowField). */}
      <div data-node-id={NODE.head}>
        <p className="text-xs text-gray-400">{scalar(eventRow, head.eyebrowField!)}</p>
        <h1 className="pt-1 text-lg font-semibold text-gray-900">{head.title}</h1>
        <p className="pt-1 text-sm text-gray-500">{head.description}</p>
      </div>

      <div className="flex flex-col gap-5 pt-6">
        {/* 방식 카드 셋. design(20:6529)에 라벨이 없으므로 지어내지 않는다. */}
        <ChoiceGroup
          id={setupMode.fieldKey}
          nodeId={NODE.setupMode}
          disabled={setupMode.initiallyDisabled}
          hasError={blockedKeys.includes(setupMode.fieldKey)}
          sourceKey={setupMode.optionsSource.key}
          sourceParams={{}}
          value={optionOf(setupMode)}
          onSelect={(option) => setValue(setupMode, option.value, option.label)}
        />

        <div className="w-56">
          <Field
            htmlFor={leader.fieldKey}
            nodeId={NODE.leader}
            label={leader.label}
            required={leader.required}
            error={errorOf(leader)}
          >
            <SearchSelect
              id={leader.fieldKey}
              placeholder={leader.placeholder}
              searchable={leader.searchable}
              disabled={leader.initiallyDisabled}
              hasError={blockedKeys.includes(leader.fieldKey)}
              sourceKey={leader.optionsSource.key}
              sourceParams={resolveParams(leader.optionsSource.params, { screenParams })}
              value={optionOf(leader)}
              onSelect={(option) => setValue(leader, option.value, option.label)}
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

        <div data-node-id={NODE.preview}>
          <p className="text-xs font-medium text-gray-700">{preview.title}</p>
          {/* 만들어질 부서가 없는 방식(빈 조직)도 있다. 비었다는 말은 출처가 갖는다 —
              design이 그 상태를 그리지 않았으므로 화면이 문장을 지어내지 않는다. */}
          {previewRows.length > 0 ? null : (
            <p data-design-state="empty" className="pt-3 text-sm text-gray-500">
              {findDataSource(preview.dataSourceKey).messages.empty}
            </p>
          )}
          <div className="flex flex-wrap gap-4 pt-3">
            {previewRows.map((row, index) => (
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

        {evt01.meta?.footerNote === undefined ||
        evt01.meta.footerNote === null ? null : (
          <p className={`rounded border p-2.5 text-xs text-blue-600 ${SOFT_BOX.blue}`}>
            {evt01.meta.footerNote}
          </p>
        )}
      </div>

      {note === null ? null : (
        <p role="status" className="pt-4 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-4 text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-8">
        {/* 화살표가 그림으로 뽑힌 자리라 lucide가 아니라 그 그림을 그린다(20:6672). */}
        <button
          type="button"
          data-node-id={NODE.back}
          onClick={() => {
            if (back.action.type === 'navigate') {
              onNavigate(
                back.action.targetScreenId,
                resolveParams(back.action.params, { screenParams }),
              )
            }
          }}
          className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.backArrow} className="size-4" />
          {back.label}
        </button>
        <PrimaryButton
          label={submitAction.labelOf(save.action as SubmitAction, save.label)}
          nodeId={NODE.save}
          onClick={pressSave}
          fullWidth={false}
          trailingArrow={false}
        />
      </div>
    </Card>
  )
}

// 셸이 없는 카드 한 장. design 20:6519(gray-50 바탕)과 20:6521(흰 카드)이다.
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-12">
      <main
        style={{ maxWidth: `${CARD_WIDTH}px` }}
        className="w-full rounded-xl border border-gray-200 bg-white p-10 shadow-sm"
      >
        {children}
      </main>
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
          // 부서장이 없는 부서에만 그려진다. 있고 없고가 표현이 아니라 뜻이다.
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
            <MemberCard
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
        {/* 제목이 바깥 항목에서 온다(titleField) — '부원 2명'이 글자 하나다. */}
        <p className="text-xs text-gray-400">{scalar(row, memberList.titleField!)}</p>
        {members.map((person, index) => (
          <MemberCard
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
