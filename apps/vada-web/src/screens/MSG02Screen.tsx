import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { FigmaAsset } from '../components/FigmaAsset'
import { readListSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, msg02 } from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
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
import { MSG01Screen } from './MSG01Screen'

// 새 메시지 방 만들기(MSG-02). 겹쳐 뜨는 화면이다.
//
// **뒤에 남는 것은 MSG-01이다.** 디자인의 루트 자식이 둘이고(30:6784 DesktopShell +
// 30:6876 검정 0.4 스크림), 그 DesktopShell이 그린 것은 MSG-01과 한 글자도 다르지
// 않다. 그래서 overlay: { screenId: MSG-01, source: 30:6876 }이고, 이 화면은
// activeNavigationScreenId도 viewer도 갖지 않는다 — 뒤에 남는 화면이 이미 말했다.
//
// **칸의 라벨이 이 화면만 semibold다.** 공용 Field는 medium으로 그린다(디자인이
// 대부분 그렇다). 한 화면 때문에 공용 부품을 바꾸면 나머지가 전부 어긋나므로
// 여기서만 직접 그린다. '선택' 딱지도 같은 이유다 — required: false를 이렇게 그린
// 프레임은 이 저장소 85장 중 이것뿐이라 공용으로 올릴 자리가 아직 아니다
// (Field가 required: true를 빨간 별표로 그리는 것과 같은 성격의 표현이다).
//
// **고른 대상이 쌓이는 자리(구성원)를 명세가 말하지 못한다.** 지금 어휘로는
// list여야 하는데 itemNoun·addLabel이 필수이고 디자인에는 둘 다 없다. 지어내지
// 않고 제목만 명세에 두었으므로, 그 아래 안내 상자는 그리지 않는다(보고서 참조).

const SCREEN = 'MSG-02'

const NODE = {
  head: '30:6879',
  close: '30:6884',
  category: '30:6889',
  roomName: '30:6901',
  members: '30:6912',
  targets: '30:6921',
  memberQuery: '30:6924',
  departments: '30:6932',
  cancel: '30:7030',
  create: '30:7032',
} as const

// 되풀이되는 줄은 **첫 사본의 노드만** 등록한다. 나머지 부서는 같은 틀이다.
const NODE_FIRST = {
  wholeDepartment: '30:6945',
  expandDepartment: '30:6947',
} as const

const ASSET = {
  close: '30:6884',
  search: '30:6925',
  departmentIcon: '30:6934',
  expandIcon: '30:6947',
} as const

interface MSG02ScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function MSG02Screen({
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: MSG02ScreenProps) {
  const head = elementByNodeId(msg02, NODE.head).spec as SummarySpec
  const close = elementByNodeId(msg02, NODE.close).spec as ButtonSpec
  const category = elementByNodeId(msg02, NODE.category).spec as SelectSpec
  const roomName = elementByNodeId(msg02, NODE.roomName).spec as InputSpec
  const members = elementByNodeId(msg02, NODE.members).spec as SummarySpec
  const targets = elementByNodeId(msg02, NODE.targets).spec as SummarySpec
  const memberQuery = elementByNodeId(msg02, NODE.memberQuery).spec as InputSpec
  const departments = elementByNodeId(msg02, NODE.departments).spec as ItemListSpec
  const cancel = elementByNodeId(msg02, NODE.cancel).spec as ButtonSpec
  const create = elementByNodeId(msg02, NODE.create).spec as ButtonSpec

  const wholeDepartment = (departments.itemFields ?? []).find(
    (field) => field.source.nodeId === NODE_FIRST.wholeDepartment,
  )?.spec as ButtonSpec
  const expandDepartment = (departments.itemFields ?? []).find(
    (field) => field.source.nodeId === NODE_FIRST.expandDepartment,
  )?.spec as ButtonSpec

  const field = useFieldDraft({ elements: msg02.elements, draft, onChangeDraft })
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)

  // 목록은 받아온 것을 화면에서 거르지 않는다. 검색어가 바뀌면 다시 조회한다.
  const rows = readListSource(
    departments.dataSourceKey,
    resolveParams(departments.params, { fields: draft.values }),
  )

  // 떠나면서 어디로 가는지도, 초안을 어떻게 끝내는지도 **명세가 말한다.**
  // 여기서 정하면 명세를 고쳐도 화면이 안 따라온다.
  const goBack = (button: ButtonSpec) => {
    if (button.action.type !== 'navigate') return
    if (button.action.scopeEvent !== undefined) {
      onScopeEvent(msg02.stateScopeKey ?? '', button.action.scopeEvent)
    }
    onNavigate(button.action.targetScreenId)
  }

  const runPending = (button: ButtonSpec) => {
    if (button.action.type === 'pending') setNote(button.action.note)
  }

  const roomNameError = field.errors[roomName.fieldKey]

  return (
    <ModalShell onClose={() => goBack(close)}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div data-node-id={NODE.head}>
          <h2 className="text-sm font-bold text-gray-900">{head.title}</h2>
          <p className="pt-1 text-xs text-gray-400">{head.description}</p>
        </div>
        <button
          type="button"
          data-node-id={NODE.close}
          aria-label={close.label}
          onClick={() => goBack(close)}
          className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-6 pt-5">
        {/* 분류 — 목록이 원격이다. '일반'과 행사들이 한 줄에 섞여 있어 명세가
            목록을 들 수 없다(message.roomCategories). 그림은 '일반'이 골라진
            모습이지만 원격 목록에서 처음 골라질 값을 명세가 부를 수 없어
            initialValue는 null이다. */}
        <div data-node-id={NODE.category} className="flex flex-col gap-1.5">
          <label id={`${category.fieldKey}-label`} className="text-xs font-semibold text-gray-700">
            <span>{category.label}</span>
            {category.required && <span className="text-red-500">*</span>}
          </label>
          <ChoiceGroup
            id={category.fieldKey}
            disabled={!field.isSelectEnabled(category)}
            labelledBy={`${category.fieldKey}-label`}
            hasError={field.errors[category.fieldKey] !== undefined}
            sourceKey={category.optionsSource.key}
            sourceParams={field.resolveSourceParams(category)}
            value={field.selectValue(category.fieldKey)}
            onSelect={(option) =>
              field.setFieldValue(category.fieldKey, option.value, option.label)
            }
            triggerRef={field.registerRef(category.fieldKey)}
          />
          {field.errors[category.fieldKey] && (
            <p id={`${category.fieldKey}-error`} className="text-xs text-red-500">
              {field.errors[category.fieldKey]}
            </p>
          )}
        </div>

        {/* 방 이름 — 이 프레임만 '선택'이라는 딱지로 required: false를 그린다.
            라벨 안에 넣으면 접근 이름이 '방 이름 선택'이 되므로 형제로 둔다. */}
        <div data-node-id={NODE.roomName} className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-1.5">
            <label
              htmlFor={roomName.fieldKey}
              className="text-xs font-semibold text-gray-700"
            >
              {roomName.label}
            </label>
            {!roomName.required && <span className="text-xs text-gray-400">선택</span>}
          </span>
          <input
            id={roomName.fieldKey}
            ref={field.registerRef(roomName.fieldKey)}
            type={roomName.inputType}
            value={draft.values[roomName.fieldKey] ?? roomName.initialValue ?? ''}
            placeholder={roomName.placeholder ?? undefined}
            aria-invalid={roomNameError === undefined ? undefined : true}
            onChange={(event) =>
              field.setFieldValue(
                roomName.fieldKey,
                event.target.value === '' ? null : event.target.value,
              )
            }
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
          <p className="text-xs text-gray-400">{roomName.helperText}</p>
          {roomNameError && <p className="text-xs text-red-500">{roomNameError}</p>}
        </div>

        {/* 구성원 — 고른 대상이 쌓이는 자리. 명세가 가진 것은 제목뿐이다. */}
        <div data-node-id={NODE.members}>
          <p className="text-xs font-semibold text-gray-700">{members.title}</p>
        </div>

        <div>
          <div data-node-id={NODE.targets} className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold text-gray-700">{targets.title}</p>
            <span
              data-node-id={NODE.memberQuery}
              className="flex w-56 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.search} className="size-3.5" />
              <input
                id={memberQuery.fieldKey}
                ref={field.registerRef(memberQuery.fieldKey)}
                type={memberQuery.inputType}
                aria-label={memberQuery.label}
                value={draft.values[memberQuery.fieldKey] ?? memberQuery.initialValue ?? ''}
                placeholder={memberQuery.placeholder ?? undefined}
                onChange={(event) =>
                  field.setFieldValue(
                    memberQuery.fieldKey,
                    event.target.value === '' ? null : event.target.value,
                  )
                }
                className="w-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </span>
          </div>

          <div className="mt-2 rounded-md border border-gray-200">
            {rows.map((row, index) => (
              <div
                key={String(row.id)}
                // 되풀이되는 줄은 첫 사본만 design과 짝지어진다.
                data-node-id={index === 0 ? NODE.departments : undefined}
                className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
              >
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.departmentIcon}
                  className="size-7 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-gray-900">
                    {String(row.name)}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {String(row.memberCountLabel)}
                  </span>
                </span>
                <button
                  type="button"
                  data-node-id={index === 0 ? NODE_FIRST.wholeDepartment : undefined}
                  onClick={() => runPending(wholeDepartment)}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  {wholeDepartment.label}
                </button>
                <button
                  type="button"
                  data-node-id={index === 0 ? NODE_FIRST.expandDepartment : undefined}
                  aria-label={expandDepartment.label}
                  onClick={() => runPending(expandDepartment)}
                  className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.expandIcon} className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 30:7026 — 바닥 줄은 gray-50 바탕에 gray-100 선이다. */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 bg-gray-50 px-6 py-4">
        <p className="text-xs text-gray-500">{msg02.meta?.footerNote}</p>
        <span className="flex items-center gap-3">
          <button
            type="button"
            data-node-id={NODE.cancel}
            onClick={() => goBack(cancel)}
            className="rounded px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {cancel.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.create}
            onClick={() =>
              // 막는 조건은 명세에 있다(executeWhen). 빈 칸을 짚고 그리로 데려가는
              // 것까지 한 곳에서 돈다.
              field.runButton(create, () => {
                void submitAction.run(create.action as SubmitAction, {
                  payload: draft.values,
                  onNavigate,
                  onScopeEvent,
                })
              })
            }
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {submitAction.labelOf(create.action as SubmitAction, create.label)}
          </button>
        </span>
      </div>

      {note === null ? null : (
        <p role="status" className="px-6 pb-4 text-xs text-gray-500">
          {note}
        </p>
      )}
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="px-6 pb-4 text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}
      {/* 보내고 나면 어디로 가는지가 아직 정해지지 않았다고 명세가 적어 두었으면
          그 글을 내놓는다. 적어만 두고 안 보여주면 보내고 나서 아무 일도 안
          일어나는 것처럼 보인다. */}
      {submitAction.pendingNote === null ? null : (
        <p role="status" className="px-6 pb-4 text-xs text-gray-500">
          {submitAction.pendingNote}
        </p>
      )}
    </ModalShell>
  )
}

interface ModalShellProps {
  onClose: () => void
  children: ReactNode
}

// 뒤에 남아 있는 화면과 그 위의 카드. 명세가 overlay로 말한 두 가지다 —
// 어느 화면이 남는가(screenId)와 이 화면이 그리는 부분이 어디인가(source).
function ModalShell({ onClose, children }: ModalShellProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <MSG01Screen onNavigate={() => undefined} />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={msg02.meta?.title ?? msg02.screenId}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
