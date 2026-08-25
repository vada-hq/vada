import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataTable } from '../components/DataTable'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { NEUTRAL_VALUE, VALUE_TEXT } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, myReq01 } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 내 구매 요청 — 행사 재정(MY-REQ-01).
//
// 이 화면이 처음인 것은 **갈피 아래로 한 겹 더 들어간다**는 것이다. 행사 작업
// 공간의 갈피 줄과 상태 줄을 그대로 그리는데 자기는 갈피가 아니다 — 재정 갈피에서
// 열리고, 켜지는 것도 재정이다. 그것을 명세가 말한다(workspace.activeTabScreenId).
//
// 상태별 개수를 목록에서 세지 않는다. 무엇을 어느 칸에 넣는지가 곧 조직의 절차라
// 서버가 안다. 화면이 세면 절차가 화면에 적히게 된다.

const SCREEN = 'MY-REQ-01'

const NODE = {
  back: '30:151',
  heading: '30:155',
  scopeNote: '30:157',
  newRequest: '30:159',
  counts: '30:164',
  table: '30:190',
} as const

const ASSET = {
  // 상태 줄의 아이콘은 화면마다 다른 노드다. 무엇을 그리는지는 셸이 알고 화면은
  // 어느 노드인지만 지목한다(EVT-FIN-01과 같은 방식).
  workspaceStatus: { startAt: '30:134' } as Record<string, string>,
  back: '30:151',
  newRequest: '30:160',
} as const

// 경로 조각 사이의 화살표. 명세는 조각이 무엇인지만 말하고, 그 사이에 어떤 그림이
// 오는지는 design이 갖는다(FIN-REQ-02와 같은 방식).
// 상태마다 색이 다르다. 어느 칸이 어느 톤인지만 여기서 말하고, 톤을 색으로 옮기는
// 일은 design/tones가 한 곳에서 한다(EVT-FIN-01의 타일과 같은 방식).
//
// 데이터가 정할 일이 아니다 — 다섯 칸이 무엇인지는 명세가 갖고 있고, 그 다섯이
// 늘거나 줄면 디자인이 먼저 바뀐다.
const COUNT_TONE: Record<string, string> = {
  reviewCount: 'blue',
  supplementCount: 'yellow',
  approvedCount: 'green',
  purchasingCount: 'purple',
  doneCount: 'gray',
}

const BREADCRUMB_SEPARATORS = ['30:80', '30:85', '30:90', '30:95']

interface MYREQ01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function MYREQ01Screen({ screenParams, onNavigate }: MYREQ01ScreenProps) {
  const [note, setNote] = useState<string | null>(null)

  const missing = (myReq01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={myReq01.screenId}
        eyebrow={myReq01.meta?.eyebrow}
        title={myReq01.meta?.title ?? myReq01.screenId}
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

  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
    }
  }
  const buttonAt = (nodeId: string) => elementByNodeId(myReq01, nodeId).spec as ButtonSpec

  const breadcrumb = myReq01.breadcrumb
  const breadcrumbRow =
    breadcrumb?.dataSourceKey === undefined
      ? null
      : readObjectSource(
          breadcrumb.dataSourceKey,
          resolveParams(breadcrumb.params, { screenParams }),
        )

  const heading = elementByNodeId(myReq01, NODE.heading).spec as SummarySpec
  const scopeNote = elementByNodeId(myReq01, NODE.scopeNote).spec as SummarySpec
  const counts = elementByNodeId(myReq01, NODE.counts).spec as SummarySpec
  const summaryRow = readObjectSource(
    counts.dataSourceKey ?? '',
    resolveParams(counts.params, { screenParams }),
  )

  const table = elementByNodeId(myReq01, NODE.table).spec as ItemListSpec
  const rows = readListSource(
    table.dataSourceKey,
    resolveParams(table.params, { screenParams }),
  )
  const tableSource = findDataSource(table.dataSourceKey)
  const back = buttonAt(NODE.back)
  const newRequest = buttonAt(NODE.newRequest)

  return (
    <AppShell
      screenId={myReq01.screenId}
      eyebrow={myReq01.meta?.eyebrow}
      title={drawnTitleOf(myReq01, screenParams)}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : String(breadcrumbRow?.[item.field] ?? ''),
            )}
          />
        )
      }
    >
      <WorkspaceHeader
        screen={myReq01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />

      {note === null ? null : (
        <p role="alert" className="mx-8 mt-6 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
          {note}
        </p>
      )}

      <div className="flex flex-col gap-6 px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              {/* 글 없는 조작. 그려지는 것은 그림뿐이고 읽어 주는 이름은 명세가 갖는다. */}
              <button
                type="button"
                data-node-id={NODE.back}
                aria-label={back.label}
                onClick={press(back)}
                className="rounded p-1 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
              >
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-3.5" />
              </button>
              <span data-node-id={NODE.heading} className="text-base font-bold text-gray-900">
                {heading.title}
              </span>
            </span>
            <span
              data-node-id={NODE.scopeNote}
              className="block pt-1 text-xs font-normal text-gray-500"
            >
              {String(summaryRow[scopeNote.descriptionField ?? ''] ?? '')}
            </span>
          </span>

          <button
            type="button"
            data-node-id={NODE.newRequest}
            onClick={press(newRequest)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.newRequest} className="size-3.5" />
            {newRequest.label}
          </button>
        </div>

        {/* 다섯 칸은 상태이지 단계가 아니다. '보완 필요'는 어느 단계에서도 생길 수
            있으므로 FIN-REQ-02의 진행 단계와 나란히 놓이지 않는다. */}
        <div data-node-id={NODE.counts} className="grid grid-cols-5 gap-3">
          {(counts.items ?? []).map((item) => (
            <span
              key={item.field}
              className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
            >
              <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
              <span
                className={`block pt-1 text-xl font-bold ${
                  VALUE_TEXT[COUNT_TONE[item.field ?? ''] ?? ''] ?? NEUTRAL_VALUE
                }`}
              >
                {String(summaryRow[item.field ?? ''] ?? '')}
              </span>
            </span>
          ))}
        </div>

        {/* 디자인이 이 표에 제목을 그리지 않는다. 없는 제목을 지어내는 대신 화면의
            이름을 표의 이름으로 쓴다 — 그려지지 않고 읽어 주기만 한다. */}
        <DataTable
          nodeId={NODE.table}
          label={heading.title ?? myReq01.screenId}
          columns={table.columns ?? []}
          rows={rows}
          emptyMessage={tableSource.messages.empty}
          fieldPresentation={{
            code: 'faint',
            title: 'title',
            amountNote: 'strong',
            itemCountNote: 'body',
            requestedAt: 'muted',
            neededOn: 'muted',
            status: 'status',
          }}
          itemActionLabel={table.itemAction?.label}
          onItemAction={(row) => {
            if (table.itemAction?.type !== 'navigate') return
            onNavigate(
              table.itemAction.targetScreenId,
              resolveParams(table.itemAction.params, { row }),
            )
          }}
        />
      </div>
    </AppShell>
  )
}
