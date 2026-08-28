import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { CHIP_ON_TINT, ROLE_CARD, ROLE_CHIP } from '../design/tones'
import { drawnTitleOf, elementByNodeId, org03c } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, ItemListSpec, SubmitAction, SummarySpec } from '../spec/types'

// 구성원 초대 패널(ORG-03C).
//
// 조직도 곁에 붙는 칸이다. 뒤에 조직도가 비치지만 **부서는 이름만 그려진다** -
// 초대하는 동안 누가 어느 부서인지는 볼 일이 아니기 때문이다. 회장단만 그대로다.
//
// 여기서 처음인 것은 **가져가기**다. 초대 링크와 초대 코드는 사람이 붙여 넣어
// 남에게 보내라고 그려 둔 값이고, 그것을 집어 가는 것은 보내는 것도 어디로 가는
// 것도 아니다(button.action의 copy). **어떻게 집어 가는지는 명세가 말하지
// 않는다** - 클립보드는 이 플랫폼의 답이지 명세의 것이 아니다.
//
// 돌아가는 자리는 ORG-03B다. 여기로 오는 입구가 둘 다 그 화면에 있고, 그 화면은
// 고치던 초안을 들고 있다 - 다른 데로 보내면 쓰던 것이 갈 곳을 잃는다.

const SCREEN = 'ORG-03C'

const NODE = {
  breadcrumb: '30:5227',
  back: '30:5237',
  executives: '30:5245',
  addExecutive: '30:5282',
  departments: '30:5288',
  close: '30:5309',
  intro: '30:5316',
  state: '30:5321',
  link: '30:5331',
  copyLink: '30:5339',
  regenerateLink: '30:5344',
  code: '30:5351',
  copyCode: '30:5359',
  regenerateCode: '30:5364',
  regenerateAll: '30:5376',
} as const

const NODE_FIRST = {
  executiveCard: '30:5254',
  department: '30:5289',
} as const

const ASSET = {
  breadcrumbSeparator: '30:5231',
  back: '30:5238',
  executiveIcon: '30:5248',
  addExecutive: '30:5283',
  close: '30:5309',
  copyLink: '30:5340',
  regenerateLink: '30:5345',
  copyCode: '30:5360',
  regenerateCode: '30:5365',
  regenerateAll: '30:5377',
} as const

// 자리 색이 그림까지 정한다(ORG-03A와 같은 규칙).
const ROLE_AVATAR: Record<string, string> = {
  yellow: '30:5256',
  blue: '30:5270',
}

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`ORG-03C의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

interface ORG03CScreenProps {
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function ORG03CScreen({ onNavigate }: ORG03CScreenProps) {
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()

  const back = elementByNodeId(org03c, NODE.back).spec as ButtonSpec
  const close = elementByNodeId(org03c, NODE.close).spec as ButtonSpec
  const executives = elementByNodeId(org03c, NODE.executives).spec as ItemListSpec
  const addExecutive = elementByNodeId(org03c, NODE.addExecutive).spec as ButtonSpec
  const departments = elementByNodeId(org03c, NODE.departments).spec as ItemListSpec
  const intro = elementByNodeId(org03c, NODE.intro).spec as SummarySpec
  const state = elementByNodeId(org03c, NODE.state).spec as SummarySpec
  const link = elementByNodeId(org03c, NODE.link).spec as SummarySpec
  const code = elementByNodeId(org03c, NODE.code).spec as SummarySpec

  const executiveRows = readListSource(executives.dataSourceKey)
  const departmentRows = readListSource(departments.dataSourceKey)
  const invite = readObjectSource(state.dataSourceKey)
  const chart = readObjectSource(intro.dataSourceKey)

  const executiveCard = executives.itemFields![0].spec as SummarySpec
  const departmentCard = departments.itemFields![0].spec as SummarySpec
  const breadcrumb = org03c.breadcrumb

  function press(spec: ButtonSpec) {
    const action = spec.action
    if (action.type === 'navigate') {
      onNavigate(action.targetScreenId)
      return
    }
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    if (action.type === 'submit') {
      void submitAction.run(action as SubmitAction, { payload: {}, onNavigate })
      return
    }
    if (action.type === 'copy') {
      // 명세가 말한 것은 '이 값을 가져갈 수 있다'까지다. 클립보드는 이 플랫폼의 답이다.
      const value = scalar(readObjectSource(action.copySourceKey), action.copyField)
      void navigator.clipboard?.writeText(value)
      setNote(`${spec.label}: ${value}`)
    }
  }

  const actionButton = (nodeId: string, assetId: string, className: string) => {
    const spec = elementByNodeId(org03c, nodeId).spec as ButtonSpec
    const running =
      spec.action.type === 'submit' && submitAction.runningKey === spec.action.mutationKey
    return (
      <button
        type="button"
        data-node-id={nodeId}
        onClick={() => press(spec)}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${className}`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={assetId} className="size-3.5" />
        {running
          ? submitAction.labelOf(spec.action as SubmitAction, spec.label)
          : spec.label}
      </button>
    )
  }

  return (
    <AppShell
      screenId={org03c.screenId}
      activeNavigationScreenId={org03c.activeNavigationScreenId}
      eyebrow={org03c.meta?.eyebrow}
      title={drawnTitleOf(org03c)}
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
        <button
          type="button"
          data-node-id={NODE.back}
          onClick={() => press(back)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-4" />
          {back.label}
        </button>
      }
    >
      <div className="flex gap-6">
        <div className="flex flex-1 flex-col items-center">
          <div
            data-node-id={NODE.executives}
            className="w-full max-w-md rounded-md border border-gray-300 bg-white"
          >
            <p className="flex items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.executiveIcon} className="size-4" />
              <span>{executives.title}</span>
            </p>
            <div className="flex flex-wrap gap-3 px-5 pt-4">
              {executiveRows.map((row, index) => {
                const tone = scalar(row, executiveCard.status![0].toneField)
                return (
                  <span
                    key={scalar(row, 'id')}
                    data-node-id={index === 0 ? NODE_FIRST.executiveCard : undefined}
                    className={`flex w-36 flex-col gap-1 rounded-md border p-3 ${
                      ROLE_CARD[tone] ?? 'border-gray-200 bg-white'
                    }`}
                  >
                    <FigmaAsset
                      screenId={SCREEN}
                      nodeId={ROLE_AVATAR[tone] ?? ''}
                      className="size-7"
                    />
                    <span className="pt-1 text-xs font-semibold text-gray-800">
                      {scalar(row, executiveCard.titleField!)}
                    </span>
                    {(executiveCard.items ?? []).map((item, at) => (
                      <span
                        key={item.field}
                        className={`text-[11px] font-medium ${
                          at === 0 ? 'text-gray-500' : 'text-gray-400'
                        }`}
                      >
                        {scalar(row, item.field!)}
                      </span>
                    ))}
                    <span
                      className={`mt-1 w-fit rounded px-2 py-0.5 text-[11px] font-semibold ${
                        ROLE_CHIP[tone] ?? ''
                      }`}
                    >
                      {scalar(row, executiveCard.status![0].field)}
                    </span>
                  </span>
                )
              })}
            </div>
            <button
              type="button"
              data-node-id={NODE.addExecutive}
              onClick={() => press(addExecutive)}
              className="flex items-center gap-1 px-5 py-3 text-xs font-medium text-blue-500 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.addExecutive} className="size-3" />
              {addExecutive.label}
            </button>
          </div>

          <span aria-hidden className="h-6 w-px bg-gray-300" />

          {/* 이 화면에서는 부서가 이름만 그려진다. 초대하는 동안 볼 일이 아니다. */}
          <div
            data-node-id={NODE.departments}
            className="flex w-full flex-wrap justify-center gap-3"
          >
            {departmentRows.map((row, index) => (
              <p
                key={scalar(row, 'id')}
                data-node-id={index === 0 ? NODE_FIRST.department : undefined}
                className="w-52 rounded-md border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-900"
              >
                {scalar(row, departmentCard.titleField!)}
              </p>
            ))}
          </div>
        </div>

        <aside className="w-80 shrink-0 border-l border-gray-200 pl-6">
          <p className="flex items-center gap-2 pb-5 text-sm font-bold text-gray-900">
            <button
              type="button"
              data-node-id={NODE.close}
              aria-label={close.label}
              onClick={() => press(close)}
              className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-4" />
            </button>
            구성원 초대
          </p>

          <div data-node-id={NODE.intro}>
            <p className="text-sm font-semibold text-gray-800">
              {scalar(chart, intro.titleField!)}
            </p>
            <p className="pt-1 text-xs text-gray-500">{intro.description}</p>
          </div>

          {/* 지금 쓸 수 있는지를 서버가 말한다 — 화면이 판정하지 않는다. */}
          <div
            data-node-id={NODE.state}
            className="mt-4 rounded-md border border-green-200 bg-green-50 p-4"
          >
            <p className="flex items-center justify-between">
              <span className="text-xs font-semibold text-green-900">{state.title}</span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                  CHIP_ON_TINT[scalar(invite, state.status![0].toneField)] ?? ''
                }`}
              >
                {scalar(invite, state.status![0].field)}
              </span>
            </p>
            <p className="pt-2 text-xs text-green-800">
              {scalar(invite, state.descriptionField!)}
            </p>
            <p className="pt-1 text-[11px] text-green-700">
              {scalar(invite, state.items![0].field!)}
            </p>
          </div>

          <div data-node-id={NODE.link} className="mt-5">
            <p className="text-xs font-medium text-gray-600">{link.title}</p>
            <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs break-all text-gray-500">
              {scalar(invite, link.items![0].field!)}
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            {actionButton(
              NODE.copyLink,
              ASSET.copyLink,
              'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
            {actionButton(
              NODE.regenerateLink,
              ASSET.regenerateLink,
              'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          </div>

          <div data-node-id={NODE.code} className="mt-5">
            <p className="text-xs font-medium text-gray-600">{code.title}</p>
            <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-lg font-bold tracking-widest text-gray-800">
              {scalar(invite, code.items![0].field!)}
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            {actionButton(
              NODE.copyCode,
              ASSET.copyCode,
              'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
            {actionButton(
              NODE.regenerateCode,
              ASSET.regenerateCode,
              'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          </div>

          <p className="pt-6 text-xs text-gray-500">{org03c.meta?.footerNote}</p>
          <div className="pt-3">
            {actionButton(NODE.regenerateAll, ASSET.regenerateAll, 'text-red-500 hover:bg-red-50')}
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
