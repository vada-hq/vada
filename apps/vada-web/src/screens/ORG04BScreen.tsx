import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { BASE_ROLE_CHIP } from '../design/tones'
import { getOptionSource } from '../option-sources/catalog'
import { elementByNodeId, org04b } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type {
  ButtonSpec,
  ItemListSpec,
  SelectSpec,
  SubmitAction,
  SummarySpec,
} from '../spec/types'

// 역할 및 권한 관리 — 회장단(ORG-04B). ORG-04가 읽는 것을 여기서 바꾼다.
//
// **바뀌는 것은 사람의 역할이지 역할의 집합이 아니다.** 배너가 그렇게 적어 두었다:
// "회장단만 구성원의 기본 역할을 회장단·부서장·부원으로 변경할 수 있습니다."
// 그래서 ORG-04의 권한 표는 열이 고정이고, 여기 고르는 것도 고정된 셋이다
// (option-sources의 org.baseRoles).
//
// 어느 구성원을 고를지가 아직 주소로 오가지 않는다 - 목록의 itemAction이
// pending인 이유이고, 오른쪽 칸은 서버가 '마지막으로 고른 사람'을 준다.

const SCREEN = 'ORG-04B'

const NODE = {
  breadcrumb: '30:6503',
  scopeBadge: '30:6518',
  banner: '30:6522',
  members: '30:6533',
  memberCount: '30:6540',
  selected: '30:6645',
  roleChoice: '30:6642',
  revert: '30:6686',
  apply: '30:6688',
} as const

const NODE_FIRST = { memberCard: '30:6543' } as const

const ASSET = {
  breadcrumbSeparator: '30:6507',
  breadcrumbSeparator2: '30:6512',
  memberChevron: '30:6555',
  // 고른 줄의 화살표는 파랗다 — 같은 그림이 아니다.
  memberChevronSelected: '30:6611',
  radioOn: '30:6676',
  banner: '30:6523',
  memberAvatar: '30:6544',
} as const

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`ORG-04B의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

interface ORG04BScreenProps {
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function ORG04BScreen({ onNavigate }: ORG04BScreenProps) {
  const scopeBadge = elementByNodeId(org04b, NODE.scopeBadge).spec as SummarySpec
  const banner = elementByNodeId(org04b, NODE.banner).spec as SummarySpec
  const members = elementByNodeId(org04b, NODE.members).spec as ItemListSpec
  const memberCount = elementByNodeId(org04b, NODE.memberCount).spec as SummarySpec
  const selected = elementByNodeId(org04b, NODE.selected).spec as SummarySpec
  const roleChoice = elementByNodeId(org04b, NODE.roleChoice).spec as SelectSpec
  const revert = elementByNodeId(org04b, NODE.revert).spec as ButtonSpec
  const apply = elementByNodeId(org04b, NODE.apply).spec as ButtonSpec

  const rows = readListSource(members.dataSourceKey)
  const counts = readObjectSource(memberCount.dataSourceKey)
  const person = readObjectSource(selected.dataSourceKey)

  // 처음 보이는 것은 그 사람의 지금 역할이다. 고르지 않고 눌러도 바뀌지 않는다.
  const [role, setRole] = useState<string>(scalar(person, 'role'))
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()

  const source = getOptionSource(roleChoice.optionsSource.key)
  const options = source.type === 'static' ? source.options : []
  const memberCard = members.itemFields![0].spec as SummarySpec
  const breadcrumb = org04b.breadcrumb

  function pressApply() {
    void submitAction.run(apply.action as SubmitAction, {
      payload: { [roleChoice.fieldKey]: role },
      onNavigate,
    })
  }

  return (
    <AppShell
      screenId={org04b.screenId}
      activeNavigationScreenId={org04b.activeNavigationScreenId}
      eyebrow={org04b.meta?.eyebrow}
      title={org04b.meta?.title ?? org04b.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator, ASSET.breadcrumbSeparator2]}
            items={breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
      headerAction={
        <span
          data-node-id={NODE.scopeBadge}
          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"
        >
          {scopeBadge.title}
        </span>
      }
    >
      <div
        data-node-id={NODE.banner}
        className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-5 py-4"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4" />
        <span>
          <span className="block text-xs font-bold text-violet-900">{banner.title}</span>
          <span className="block pt-1 text-xs text-violet-700">{banner.description}</span>
        </span>
      </div>

      <div className="flex gap-6 pt-5">
        <section
          data-node-id={NODE.members}
          className="flex-1 rounded-xl border border-gray-200 bg-white"
        >
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <span>
              <span className="block text-sm font-bold text-gray-900">{members.title}</span>
              <span className="block pt-1 text-xs text-gray-500">변경할 구성원을 선택하세요.</span>
            </span>
            <span data-node-id={NODE.memberCount} className="text-xs text-gray-400">
              {scalar(counts, memberCount.items![0].field!)}
            </span>
          </div>
          {rows.map((row, index) => (
            <button
              key={scalar(row, 'id')}
              type="button"
              data-node-id={index === 0 ? NODE_FIRST.memberCard : undefined}
              onClick={() => {
                const action = members.itemAction
                if (action?.type === 'pending') setNote(action.note)
              }}
              className={`flex w-full items-center gap-3 border-b border-gray-100 px-5 py-4 text-left last:border-b-0 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
                scalar(row, 'id') === scalar(person, 'id') ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.memberAvatar} className="size-8" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-gray-800">
                  {scalar(row, memberCard.titleField!)}
                </span>
                <span className="block text-xs font-medium text-gray-500">
                  {scalar(row, memberCard.items![0].field!)}
                </span>
              </span>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  BASE_ROLE_CHIP[scalar(row, memberCard.status!.toneField)] ?? ''
                }`}
              >
                {scalar(row, memberCard.status!.field)}
              </span>
              <FigmaAsset
                screenId={SCREEN}
                nodeId={
                  scalar(row, 'id') === scalar(person, 'id')
                    ? ASSET.memberChevronSelected
                    : ASSET.memberChevron
                }
                className="size-3"
              />
            </button>
          ))}
        </section>

        <aside
          data-node-id={NODE.roleChoice}
          className="w-80 shrink-0 rounded-xl border border-gray-200 bg-white p-5"
        >
          {/* 패널 제목이 곧 이 고르기의 라벨이다. 별표는 따로 두어 대조기가
              보는 글에는 섞이지 않게 한다(Field와 같은 규칙). */}
          <p id={`${roleChoice.fieldKey}-label`} className="text-sm font-bold text-gray-900">
            <span>{roleChoice.label}</span>
            {roleChoice.required && <span className="text-red-500">*</span>}
          </p>

          <div data-node-id={NODE.selected} className="border-b border-gray-100 pt-4 pb-4">
            <p className="text-sm font-bold text-gray-800">
              {scalar(person, selected.titleField!)}
            </p>
            <p className="flex items-center gap-1 pt-1 text-xs text-gray-500">
              {/* design은 부서·라벨·딱지를 한 줄로 그렸고 라벨 뒤에 빈칸이 있다. */}
              <span>{`${scalar(person, selected.items![0].field!)} · ${selected.items![0].label} `}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  BASE_ROLE_CHIP[scalar(person, selected.status!.toneField)] ?? ''
                }`}
              >
                {scalar(person, selected.status!.field)}
              </span>
            </p>
          </div>

          {/* 고를 수 있는 것은 고정된 셋이다. 역할의 집합은 여기서 바뀌지 않는다.
              명세가 말하는 것은 '펼친 묶음에서 고른다'(choiceGroup)까지이고,
              칩으로 그릴지 설명이 붙은 줄로 그릴지는 design이 정한다 - 이 화면은
              역할마다 무엇을 할 수 있는지를 함께 읽혀야 해서 줄로 그린다. */}
          <div
            role="radiogroup"
            aria-labelledby={`${roleChoice.fieldKey}-label`}
            className="flex flex-col gap-2 pt-5"
          >
            {options.map((option) => {
              const on = option.value === role
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setRole(option.value)
                  }}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
                    on ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  {on ? (
                    <FigmaAsset screenId={SCREEN} nodeId={ASSET.radioOn} className="mt-0.5 size-4" />
                  ) : (
                    <span className="mt-0.5 block size-4 shrink-0 rounded-full border border-gray-300 bg-white" />
                  )}
                  <span>
                    <span className="block text-xs font-semibold text-gray-800">
                      {option.label}
                    </span>
                    <span className="block pt-1 text-xs font-medium text-gray-500">{option.description}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex gap-2 pt-5">
            <button
              type="button"
              data-node-id={NODE.revert}
              onClick={() => {
                if (revert.action.type === 'navigate') onNavigate(revert.action.targetScreenId)
              }}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              {revert.label}
            </button>
            <button
              type="button"
              data-node-id={NODE.apply}
              onClick={pressApply}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              {submitAction.labelOf(apply.action as SubmitAction, apply.label)}
            </button>
          </div>

          {note === null ? null : (
            <p role="status" className="pt-4 text-xs text-gray-500">
              {note}
            </p>
          )}
          {submitAction.errorMessage === null ? null : (
            <p role="alert" className="pt-4 text-xs text-red-500">
              {submitAction.errorMessage}
            </p>
          )}
        </aside>
      </div>
    </AppShell>
  )
}
