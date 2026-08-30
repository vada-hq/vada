import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { INFO_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, rec01 } from '../spec/screens'
import { targetScreenOf, paramsOf } from '../spec/types'
import type { DisplayAction, InputSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 완료된 행사(REC-01).
//
// **셸의 '기록' 메뉴가 가리키는 화면 자신이다** — 그래서 activeNavigationScreenId가
// 없다(MSG-01·FIN-00과 같은 자리). 자기 id로 메뉴가 켜진다.
//
// 진행 중인 행사 목록(EVT-00A)과 다른 물건이다. event.list는 완료된 행사를 주지
// 않는다고 카탈로그에 적혀 있고, 그래서 여기가 별도 출처를 읽는다.
//
// **셋째 카드에는 단추가 없다.** 없는 것이 표현이 아니라 뜻이다 — 아카이브가 아직
// 발행되지 않았으므로 열 것이 없고, 그 자리에는 서버가 준 까닭이 대신 온다
// (record.completedEvents의 actionLabel·blockedNote가 짝이고 둘 중 하나만 온다.
// event.checklist의 actionLabel·targetKind와 같은 규칙이다).
//
// **'완료' 딱지의 색은 데이터가 주지 않는다.** 이 목록에는 완료된 행사만 오므로
// 갈릴 것이 없다. 아카이브 딱지만 톤 이름을 받는다(STATE_CHIP).

const SCREEN = 'REC-01'

const NODE = {
  alert: '30:3381',
  query: '30:3393',
  list: '30:3398',
} as const

const ASSET = {
  alert: '30:3382',
  search: '30:3390',
  // 되풀이되는 줄의 그림은 첫 카드의 것을 본으로 쓴다 — 같은 그림이면 하나만
  // 지목해도 대조가 통과한다(내용으로 묶는다).
  date: '30:3412',
  host: '30:3419',
  breadcrumbSeparator: '30:3370',
} as const

// 행사 자체의 상태 딱지. 톤 이름을 받지 않는 자리라 design/tones.ts의 표를 쓰지
// 않는다 — 이 목록의 모든 행사가 완료된 것이라 색이 갈릴 일이 없다.
const COMPLETED_CHIP = 'border border-gray-200 bg-gray-100 text-gray-500'

function scalar(row: DataRow, field: string | undefined): string {
  const value = row[field ?? '']
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

function rowsOf(row: DataRow, field: string | undefined): DataRow[] {
  const value = row[field ?? '']
  return Array.isArray(value) ? value : []
}

interface REC01ScreenProps {
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function REC01Screen({ onNavigate }: REC01ScreenProps) {
  const alert = elementByNodeId(rec01, NODE.alert).spec as SummarySpec
  const query = elementByNodeId(rec01, NODE.query).spec as InputSpec
  const list = elementByNodeId(rec01, NODE.list).spec as ItemListSpec

  const [queryValue, setQueryValue] = useState(query.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const alertRow = readObjectSource(alert.dataSourceKey)
  // 받아온 것을 화면에서 거르지 않는다. 검색어가 바뀌면 다시 조회한다.
  const rows = readListSource(
    list.dataSourceKey,
    resolveParams(list.params, { fields: { [query.fieldKey]: queryValue } }),
  )

  // 어느 조각이 어디에 그려지는지는 명세의 columns가 말한다. 조각 이름을 화면에
  // 박으면 출처의 이름이 바뀌어도 아무도 모른다.
  const [status, archive, title, date, host, highlights, completed, blocked] =
    list.columns ?? []

  const open = (action: DisplayAction, row: DataRow) => () => {
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    const target = targetScreenOf(action, row)
    if (target === null) return
    onNavigate(target, resolveParams(paramsOf(action), { row }))
  }

  const breadcrumb = rec01.breadcrumb

  return (
    <AppShell
      screenId={rec01.screenId}
      eyebrow={rec01.meta?.eyebrow}
      title={rec01.meta?.title ?? rec01.screenId}
      description={rec01.meta?.description}
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
      {/* 미발행 건수. 서버가 세고 화면은 그 문구를 그대로 그린다. 한 건도 없으면
          이 조각이 오지 않으므로 띠 자체가 그려지지 않는다. */}
      {scalar(alertRow, (alert.items ?? [])[0]?.field) === '' ? null : (
        <p
          data-node-id={NODE.alert}
          className="inline-flex items-center gap-1.5 rounded-md border border-orange-100 bg-orange-50 px-3 py-1.5"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.alert} className="size-3.5" />
          <span className="text-xs font-medium text-orange-800">
            {scalar(alertRow, (alert.items ?? [])[0]?.field)}
          </span>
        </p>
      )}

      <div className="flex items-center gap-3 pt-4 pb-4">
        {/* 등록 노드는 테두리를 가진 칸이다(30:3393). 아이콘은 그 칸 밖의
            형제라 design이 이 안에 배경을 주지 않았다(EVT-00A와 같은 자리). */}
        <label
          data-node-id={NODE.query}
          className="flex w-full max-w-[280px] min-w-0 items-center gap-2 rounded-md border border-gray-200 px-3 py-2"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.search} className="size-3.5 shrink-0" />
          <input
            aria-label={query.label}
            type={query.inputType}
            value={queryValue}
            placeholder={query.placeholder ?? query.label}
            onChange={(event) => setQueryValue(event.target.value)}
            className="min-w-0 flex-1 text-sm text-gray-700 placeholder:text-gray-700 focus:outline-none"
          />
        </label>
      </div>

      <div data-node-id={NODE.list} className="flex flex-col gap-3 pb-12">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500">
            {findDataSource(list.dataSourceKey).messages.empty}
          </p>
        ) : (
          rows.map((row) => {
            const actionLabel =
              list.itemAction?.labelField === undefined
                ? ''
                : scalar(row, list.itemAction.labelField)
            return (
              <div
                key={scalar(row, 'id')}
                className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4"
              >
                <div>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${COMPLETED_CHIP}`}
                    >
                      {scalar(row, (status?.fields ?? [])[0])}
                    </span>
                    <span
                      data-design-rule="state-chip"
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        STATE_CHIP[scalar(row, archive?.toneField)] ?? NEUTRAL_CHIP
                      }`}
                    >
                      {scalar(row, (archive?.fields ?? [])[0])}
                    </span>
                  </span>

                  <span className="block pt-2 text-sm font-semibold text-gray-900">
                    {scalar(row, (title?.fields ?? [])[0])}
                  </span>

                  <span className="flex flex-wrap items-center gap-4 pt-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <FigmaAsset screenId={SCREEN} nodeId={ASSET.date} className="size-3" />
                      <span>{scalar(row, (date?.fields ?? [])[0])}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <FigmaAsset screenId={SCREEN} nodeId={ASSET.host} className="size-3" />
                      <span>{scalar(row, (host?.fields ?? [])[0])}</span>
                    </span>
                  </span>

                  {/* 딱지 개수는 행사마다 다르다 — 무엇을 앞세울지는 서버가 정한다. */}
                  <span className="flex flex-wrap items-center gap-2 pt-2.5">
                    {rowsOf(row, (highlights?.fields ?? [])[0]).map((highlight) => (
                      <span
                        key={scalar(highlight, 'label')}
                        className={`rounded px-2 py-1 text-xs ${INFO_CHIP}`}
                      >
                        {scalar(highlight, 'label')}
                      </span>
                    ))}
                  </span>

                  <span className="block pt-2.5 text-xs text-gray-400">
                    {scalar(row, (completed?.fields ?? [])[0])}
                  </span>
                </div>

                {/* 갈 곳이 있으면 단추, 없으면 그 까닭. 둘 중 하나만 온다. */}
                {actionLabel === '' || list.itemAction === undefined ? (
                  <span className="shrink-0 text-right text-xs text-gray-400">
                    {scalar(row, (blocked?.fields ?? [])[0])}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={open(list.itemAction, row)}
                    className="shrink-0 rounded text-xs font-medium text-blue-500 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                  >
                    {actionLabel}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {note === null ? null : (
        <p role="status" className="pb-6 text-xs text-gray-500">
          {note}
        </p>
      )}
    </AppShell>
  )
}
