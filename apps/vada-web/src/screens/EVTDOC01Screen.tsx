import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { ACCENT_BAR, CHOICE_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evtDoc01 } from '../spec/screens'
import type { ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'

// 행사 문서(EVT-DOC-01).
//
// 행사 작업 공간의 **세 번째** 화면이다. 갈피 줄·상태 줄·제목이 여기 없는 것은
// 앞의 둘과 같다 — shell.json의 작업 공간이 갖고 화면은 어디에 그리는지만 준다.
//
// 여기서 처음인 것은 **표**다. 지금까지의 목록은 전부 카드였고, 표는 열 머리를
// 갖는다. 그 글은 그려지는 것이므로 명세가 갖는다(itemList.columns) — 화면은
// figma.design.json을 실행 중에 읽지 않는다.
//
// 필터의 개수는 MY-01의 업무 탭에서 이미 있던 것이고(optionCounts), 여기서
// 인자를 받게 됐을 뿐이다 — 무엇을 고를 수 있는지는 고정이어도 몇 건인지는
// 어느 행사의 것인지에 달렸다.

const SCREEN = 'EVT-DOC-01'

const NODE = {
  stats: '28:540',
  filter: '28:562',
  table: '28:578',
} as const

const ASSET = {
  workspaceStatus: { startAt: '28:522' } as Record<string, string>,
  // 표의 문서 아이콘. 네 줄이 같은 그림이라 하나만 지목한다.
  document: '28:590',
} as const

interface EVTDOC01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVTDOC01Screen({ screenParams, onNavigate }: EVTDOC01ScreenProps) {
  const filter = elementByNodeId(evtDoc01, NODE.filter).spec as SelectSpec
  const [status, setStatus] = useState(filter.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const missing = (evtDoc01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evtDoc01.screenId}
        eyebrow={evtDoc01.meta?.eyebrow}
        title={evtDoc01.meta?.title ?? evtDoc01.screenId}
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

  const stats = elementByNodeId(evtDoc01, NODE.stats).spec as SummarySpec
  const statsRow = readObjectSource(
    stats.dataSourceKey ?? '',
    resolveParams(stats.params, { screenParams }),
  )

  const optionSource = getOptionSource(filter.optionsSource.key)
  const options = optionSource.type === 'static' ? optionSource.options : []
  const counts = filter.optionCounts
    ? readObjectSource(
        filter.optionCounts.dataSourceKey,
        resolveParams(filter.optionCounts.params, { screenParams }),
      )
    : null

  const table = elementByNodeId(evtDoc01, NODE.table).spec as ItemListSpec
  // 값이 바뀌면 서버에 다시 묻는다 — 받아온 것을 화면에서 거르지 않는다.
  const rows = readListSource(
    table.dataSourceKey,
    resolveParams(table.params, { screenParams, fields: { [filter.fieldKey]: status } }),
  )

  return (
    <AppShell
      screenId={evtDoc01.screenId}
      eyebrow={evtDoc01.meta?.eyebrow}
      title={drawnTitleOf(evtDoc01, screenParams)}
      footerNote={evtDoc01.meta?.footerNote}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evtDoc01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />

      {/* 화면의 이름은 작업 공간의 제목(행사 이름)이 아니라 본문 머리에 온다. */}
      <div className="pt-6">
        <h2 className="text-sm font-semibold text-gray-900">{evtDoc01.meta?.title}</h2>
        <p className="pt-1 text-xs text-gray-500">{evtDoc01.meta?.description}</p>
      </div>

      {note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      {/* 라벨-값-보조 3단. EVT-02의 참가 현황 타일과 같은 모양인데 색이 없다. */}
      <div
        data-node-id={NODE.stats}
        className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3"
      >
        {(stats.items ?? []).map((item) => (
          <span
            key={item.label}
            className="block rounded-xl border border-gray-200 bg-white p-3.5"
          >
            <span className="block text-xs text-gray-400">{item.label}</span>
            <span className="flex items-baseline gap-1.5 pt-1">
              <span className="text-base font-bold text-gray-900">
                {String(statsRow[item.field ?? ''])}
              </span>
              <span className="text-xs text-gray-400">
                {String(statsRow[item.descriptionField ?? ''])}
              </span>
            </span>
          </span>
        ))}
      </div>

      {/* 고를 것은 명세가, 몇 건인지는 데이터가 정한다. */}
      <div
        data-node-id={NODE.filter}
        data-design-rule="choice-chip"
        role="radiogroup"
        aria-label={optionSource.description}
        className="flex flex-wrap gap-2 pt-4"
      >
        {options.map((option) => {
          const value = String(option.value)
          const selected = value === status
          const count = counts === null ? undefined : counts[value]
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setStatus(value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                selected ? CHOICE_CHIP.on : CHOICE_CHIP.off
              }`}
            >
              <span>{option.label}</span>
              {count === undefined ? null : (
                <span className={`pl-1.5 ${selected ? 'text-gray-300' : 'text-gray-400'}`}>
                  {String(count)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        data-node-id={NODE.table}
        className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        {/* 열 머리는 그려지는 글이라 명세가 갖는다. */}
        <div className="flex border-b border-gray-100 bg-gray-50 px-4 py-2.5">
          {(table.columns ?? []).map((column, at) => (
            <span
              key={column.label}
              className={`text-[10px] font-semibold text-gray-400 ${COLUMN_WIDTH[at]}`}
            >
              {column.label}
            </span>
          ))}
        </div>

        {rows.length === 0 ? (
          <p data-design-state="empty" className="px-4 py-6 text-xs text-gray-400">
            {findDataSource(table.dataSourceKey).messages.empty}
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={String(row.id)} className="border-b border-gray-100 last:border-b-0">
                {/* 줄 전체가 누르는 자리다 — 명세는 항목 하나를 누른다고만 말한다. */}
                <button
                  type="button"
                  onClick={() => {
                    if (table.itemAction?.type === 'pending') setNote(table.itemAction.note)
                  }}
                  aria-label={`${String(row.title)} ${table.itemAction?.label ?? ''}`}
                  className="flex w-full items-center px-4 py-3 text-left hover:bg-gray-50"
                >
                <span className={`flex min-w-0 items-start gap-2.5 ${COLUMN_WIDTH[0]}`}>
                  {/* 어느 국면의 문서인지가 선의 색을 정한다. */}
                  <span
                    className={`mt-0.5 h-9 w-0.5 shrink-0 rounded-full ${
                      ACCENT_BAR[String(row.tone)] ?? ACCENT_BAR.gray
                    }`}
                  />
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={ASSET.document}
                    className="mt-1 size-3.5 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[10px] font-medium text-blue-600">
                        {String(row.category)}
                      </span>
                      <span className="truncate text-xs font-semibold text-gray-900">
                        {String(row.title)}
                      </span>
                    </span>
                    <span className="block truncate pt-1 text-[10px] text-gray-500">
                      {String(row.description)}
                    </span>
                  </span>
                </span>

                <span className={COLUMN_WIDTH[1]}>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      STATE_CHIP[String(row.statusTone)] ?? NEUTRAL_CHIP
                    }`}
                  >
                    {String(row.status)}
                  </span>
                </span>

                <span className={`text-xs text-gray-400 ${COLUMN_WIDTH[2]}`}>
                  {String(row.updatedNote)}
                </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}

// 열 폭은 명세의 것이 아니다 — 명세는 무엇이 어느 열에 오는지만 말한다.
// design(28:579)이 그린 비율을 화면이 안다.
const COLUMN_WIDTH = ['flex-1', 'w-24 shrink-0', 'w-28 shrink-0'] as const
