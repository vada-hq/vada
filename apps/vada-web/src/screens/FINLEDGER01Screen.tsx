import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { SearchSelect } from '../components/SearchSelect'
import { NEUTRAL_CHIP, NEUTRAL_VALUE, STATE_CHIP, VALUE_TEXT } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { Option } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, finLedger01 } from '../spec/screens'
import type { InputSpec, ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'

// 사용 내역(FIN-LEDGER-01).
//
// 조직 전체 재정(FIN-00) 아래의 화면이라 셸의 '재정'을 켜 둔다. FIN-00의
// '최근 지출 내역'과 이 화면의 표는 **같은 장부**를 다르게 자른 것이다 —
// 저쪽은 겉면에 몇 줄만 얹고 이쪽은 다섯 조건으로 걸러 본다.
//
// 거르는 값은 전부 **조회 인자**다. 받아온 것을 화면에서 다시 거르지도 자르지도
// 않는다 — 몇 건 중 몇 건인지조차 목록 자신은 모르고, 아래 줄이 그것을 따로
// 읽는다(finance.ledgerScope).
//
// **표 아래 오른쪽 글에 역할 이름이 들어 있다.** 그 문장은 서버가 완성해 준다
// (handlingNote). 화면이 적으면 조직 규칙이 바뀔 때마다 조용히 틀린다.

const SCREEN = 'FIN-LEDGER-01'

const NODE = {
  breadcrumb: '30:3125',
  termTotal: '30:3140',
  monthTotal: '30:3145',
  proofDone: '30:3150',
  proofMissing: '30:3155',
  search: '30:3161',
  month: '30:3167',
  event: '30:3172',
  department: '30:3177',
  budgetItem: '30:3182',
  ledger: '30:3188',
  scope: '30:3287',
} as const

const ASSET = {
  breadcrumbSeparator: '30:3129',
  search: '30:3162',
  monthChevron: '30:3169',
  eventChevron: '30:3174',
  departmentChevron: '30:3179',
  budgetItemChevron: '30:3184',
} as const

// 값 넷 중 하나만 도드라진다. 어느 것이 무슨 색인지는 데이터가 아니라 design이
// 정한다(FIN-00의 CARDS와 같은 자리) — 증빙이 빠진 건수는 손을 대야 하는 값이다.
const TILE_TONE: Record<string, string> = { proofMissing: 'red' }

const FILTERS = [
  { node: NODE.month, chevron: ASSET.monthChevron },
  { node: NODE.event, chevron: ASSET.eventChevron },
  { node: NODE.department, chevron: ASSET.departmentChevron },
  { node: NODE.budgetItem, chevron: ASSET.budgetItemChevron },
] as const

interface FINLEDGER01ScreenProps {
  /** 어느 결제 단계만 볼 것인가는 주소가 실어 온다(stage). 화면 안에는 그 자리가 없다. */
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function FINLEDGER01Screen({ screenParams, onNavigate }: FINLEDGER01ScreenProps) {
  const search = elementByNodeId(finLedger01, NODE.search).spec as InputSpec
  const ledger = elementByNodeId(finLedger01, NODE.ledger).spec as ItemListSpec
  const scope = elementByNodeId(finLedger01, NODE.scope).spec as SummarySpec

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Record<string, Option | null>>({})

  const specOf = (nodeId: string) =>
    elementByNodeId(finLedger01, nodeId).spec as SelectSpec

  // 고른 값은 조회 인자다. 고르지 않은 칸은 빈 값이고, 그때 서버가 무엇을
  // 돌려줄지는 서버가 정한다 — 화면이 '전체'를 지어내지 않는다.
  const fieldValues: Record<string, string> = { [search.fieldKey]: query }
  for (const filter of FILTERS) {
    const spec = specOf(filter.node)
    fieldValues[spec.fieldKey] = picked[spec.fieldKey]?.value ?? ''
  }

  // 어느 결제 단계만 볼 것인가는 **주소가 실어 온다** — 전체 재정의 두 '내역'이
  // 각각 다른 값을 싣고, 화면 안에는 그것을 고르는 자리가 없다(그림에 없다).
  const ledgerParams = resolveParams(ledger.params, { screenParams, fields: fieldValues })
  const rows = readListSource(ledger.dataSourceKey, ledgerParams)
  const scopeRow = readObjectSource(
    scope.dataSourceKey,
    resolveParams(scope.params, { screenParams, fields: fieldValues }),
  )

  const tile = (nodeId: string) => {
    const spec = elementByNodeId(finLedger01, nodeId).spec as SummarySpec
    const row = readObjectSource(
      spec.dataSourceKey,
      resolveParams(spec.params, { fields: fieldValues }),
    )
    const item = (spec.items ?? [])[0]
    const tone = TILE_TONE[item?.field ?? '']
    return (
      <div
        key={nodeId}
        data-node-id={nodeId}
        className="rounded-xl border border-gray-200 bg-white px-5 py-4"
      >
        {/* 이 칸의 제목만 서버가 준다 — '7월'은 고른 달이 정하기 때문이다. */}
        <p className="text-xs text-gray-400">
          {spec.title ?? String(row[spec.titleField ?? ''])}
        </p>
        <p
          data-design-rule="value-text"
          className={`pt-1 text-lg font-bold ${
            tone === undefined ? NEUTRAL_VALUE : (VALUE_TEXT[tone] ?? NEUTRAL_VALUE)
          }`}
        >
          {String(row[item?.field ?? ''])}
        </p>
      </div>
    )
  }

  const breadcrumb = finLedger01.breadcrumb

  return (
    <AppShell
      screenId={finLedger01.screenId}
      activeNavigationScreenId={finLedger01.activeNavigationScreenId}
      eyebrow={finLedger01.meta?.eyebrow}
      title={finLedger01.meta?.title ?? finLedger01.screenId}
      description={finLedger01.meta?.description}
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[NODE.termTotal, NODE.monthTotal, NODE.proofDone, NODE.proofMissing].map(tile)}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-5">
        <span data-node-id={NODE.search} className="w-64">
          <label htmlFor={search.fieldKey} className="sr-only">
            {search.label}
          </label>
          {/* design은 돋보기와 입력칸을 한 테두리 안에 함께 담는다(ORG-07A와 같다). */}
          <span className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-600/50">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.search} className="size-3.5 shrink-0" />
            <input
              id={search.fieldKey}
              type={search.inputType}
              value={query}
              placeholder={search.placeholder ?? search.label}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
            />
          </span>
        </span>

        {FILTERS.map((filter) => {
          const spec = specOf(filter.node)
          return (
            // 고르기 칸의 테두리는 gray-300으로 통일한다(SearchSelect). 이 화면의
            // design만 -200이라 그 차이를 규칙 한 줄에 걸어 둔다.
            <span
              key={filter.node}
              data-node-id={filter.node}
              data-design-rule="filter-select"
              className="w-40"
            >
              <label htmlFor={spec.fieldKey} className="sr-only">
                {spec.label}
              </label>
              <SearchSelect
                id={spec.fieldKey}
                placeholder={spec.placeholder}
                searchable={spec.searchable}
                disabled={spec.initiallyDisabled}
                sourceKey={spec.optionsSource.key}
                sourceParams={{}}
                value={picked[spec.fieldKey] ?? null}
                onSelect={(option) =>
                  setPicked((current) => ({ ...current, [spec.fieldKey]: option }))
                }
                chevron={
                  <FigmaAsset screenId={SCREEN} nodeId={filter.chevron} className="size-4" />
                }
              />
            </span>
          )
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table data-node-id={NODE.ledger} aria-label="사용 내역" className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {(ledger.columns ?? []).map((column, index) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`px-5 py-2.5 text-xs font-semibold text-gray-500 ${
                    index === 5 ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={(ledger.columns ?? []).length}
                  className="px-5 py-10 text-center text-sm text-gray-500"
                >
                  {findDataSource(ledger.dataSourceKey).messages.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row.id)} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-5 py-3 text-xs text-gray-500">{String(row.date)}</td>
                  <td className="px-5 py-3 text-xs font-medium text-gray-800">
                    {String(row.title)}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600">{String(row.context)}</td>
                  <td className="px-5 py-3 text-xs text-gray-600">
                    {String(row.department)}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600">
                    {String(row.budgetItem)}
                  </td>
                  <td className="px-5 py-3 text-right text-xs font-bold text-gray-900">
                    {String(row.amountNote)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      data-design-state
                      data-design-rule="state-chip"
                      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                        STATE_CHIP[String(row.proofTone)] ?? NEUTRAL_CHIP
                      }`}
                    >
                      {String(row.proof)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 표와 형제로 그려지는 줄이다. 몇 건 중 몇 건인지도, 증빙을 어디서
            처리하는지도 서버가 완성한 문장으로 온다. */}
        <div
          data-node-id={NODE.scope}
          className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 px-5 py-3"
        >
          {(scope.items ?? []).map((item) => (
            <span key={item.field} className="text-xs text-gray-400">
              {String(scopeRow[item.field ?? ''])}
            </span>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
