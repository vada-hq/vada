import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { NEUTRAL_CHIP, NEUTRAL_VALUE, TABLE_STATE_CHIP, VALUE_TEXT } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, fin00, fin00b, navigateTarget } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import type {
  ButtonSpec,
  DisplayAction,
  ItemListSpec,
  SelectSpec,
  SummarySpec,
} from '../spec/types'

// 전체 재정 현황(FIN-00).
//
// **조직 전체의 재정이다. 행사 하나의 재정(EVT-FIN-01 계열)과 다른 자리다.**
// 사이드바의 '재정'이 가리키는 화면 자신이라 activeNavigationScreenId를 갖지
// 않는다 — 자기 id로 메뉴를 찾으면 된다. FIN-REQ-* 여섯은 전부 '운영' 아래이고
// 빵부스러기도 '운영 > 행사 > …'로 시작한다. 둘 사이에 그림이 그린 이음은 없다.
//
// 이 화면이 셈하지 않는 것: 집행률도, 사용 가능액도, 막대의 두 마디도 전부
// 서버가 준다. 무엇을 실제 지출로 보고 무엇을 예정으로 보는지가 조직의 재정
// 규칙이기 때문이다(EVT-FIN-01과 같은 이유). 화면이 하는 셈은 하나도 없다.
//
// **진행 막대는 새 어휘가 아니다** — 수는 데이터(0-100)이고 막대는 디자인이다
// (home.events의 progressPercent 선례).

const SCREEN = 'FIN-00'

const NODE = {
  breadcrumb: '30:2549',
  period: '30:2559',
  intro: '30:2570',
  totalBudget: '30:2576',
  spent: '30:2589',
  planned: '30:2602',
  available: '30:2616',
  execution: '30:2629',
  scope: '30:2650',
  breakdown: '30:2655',
  recent: '30:2697',
  ledgerLink: '30:2701',
  proof: '30:2735',
} as const

const ASSET = {
  breadcrumbSeparator: '30:2553',
  ledgerLink: '30:2703',
} as const

// 카드 넷. **어느 카드가 무슨 색인지는 데이터가 아니라 design이 정한다**
// (HOME-01K의 FINANCE_TILE_TONE·EVT-FIN-01의 TILE_TONE 선례) — 값이 무엇이든
// 총예산은 파랗고 사용 가능액은 남색이다. 톤 이름을 색으로 옮기는 일만
// design/tones가 한다.
//
// 부연의 굵기가 넷 중 둘만 500이다. 그 둘이 마침 **눌리는 카드**이고, FIN-00B에서
// 총예산 카드가 눌리는 카드가 되자 그 부연도 500으로 바뀌었다 — 디자이너가 카드
// 부품을 둘로 나눠 쓴 것이지 뜻이 다른 것이 아니다. 그린 대로 옮긴다.
const CARDS = [
  { node: NODE.totalBudget, asset: '30:2577', tone: 'blue', noteWeight: 'font-normal' },
  { node: NODE.spent, asset: '30:2591', tone: 'green', noteWeight: 'font-medium' },
  { node: NODE.planned, asset: '30:2604', tone: 'orange', noteWeight: 'font-medium' },
  { node: NODE.available, asset: '30:2617', tone: 'indigo', noteWeight: 'font-normal' },
] as const

// **예산을 편성할 수 있는 사람이 보면 총예산 카드가 눌린다**(변형 FIN-00B).
// 나머지 셋은 노드 대 노드로 같으므로 이 한 장만 갈아 끼운다 — 변형이 '다른
// 부분만' 등록하는 것과 같은 생각이다.
//
// 갈아 끼울 때 화면 이름까지 함께 바뀐다. 그림 조각은 프레임마다 다른 노드라
// (FIN-00의 30:2577과 FIN-00B의 30:2865는 같은 그림이고 다른 자리다) 어느 그림에서
// 꺼낼지도 함께 옮겨야 한다.
const VARIANT_BUDGET_CARD = {
  screen: 'FIN-00B',
  node: '30:2863',
  asset: '30:2865',
  tone: 'blue',
  // 눌리는 카드가 되면 부연이 500이 된다. 뜻이 바뀐 것이 아니라 디자이너가 카드
  // 부품을 둘로 나눠 쓴 것이다(위의 주석).
  noteWeight: 'font-medium',
} as const

// 증빙 갈래마다의 색. 카드와 같은 규칙이다 — 세는 갈래가 명세에 고정이므로
// 색 이름도 데이터가 주지 않는다.
const PROOF_TONE: Record<string, string> = {
  completed: 'green',
  supplement: 'yellow',
  unregistered: 'red',
}

interface FIN00ScreenProps {
  /** 어느 그림을 그리는지. 변형(FIN-00B)은 주소가 같고 보는 사람이 가른다. */
  screenId?: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function FIN00Screen({ screenId = SCREEN, onNavigate }: FIN00ScreenProps) {
  // **가르는 것은 데이터다** — 명세가 variantOf.when으로 그렇게 말한다
  // (finance.overviewViewer의 canPlanBudget). 이 저장소에는 로그인한 사람이 없어
  // 그 조각을 답할 자리가 없으므로, 개발용으로는 어느 그림을 열었는지가 그 자리를
  // 대신한다. 조건의 이름은 명세에 남아 있고 검사가 그것이 실재하는지 본다.
  const planning = screenId === VARIANT_BUDGET_CARD.screen
  const cards = planning
    ? [{ ...VARIANT_BUDGET_CARD, from: fin00b }, ...CARDS.slice(1).map((card) => ({ ...card, screen: SCREEN, from: fin00 }))]
    : CARDS.map((card) => ({ ...card, screen: SCREEN, from: fin00 }))
  const scopeSpec = elementByNodeId(fin00, NODE.scope).spec as SelectSpec
  const [scope, setScope] = useState(scopeSpec.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const overview = readObjectSource(
    (elementByNodeId(fin00, NODE.totalBudget).spec as SummarySpec).dataSourceKey,
  )

  // 눌러 갈 곳이 있는 것과 아직 없는 것이 나란히 있다. 아직 없는 자리는
  // 조용히 아무 일도 안 하는 대신 그 사실을 내놓는다.
  const press = (action: DisplayAction) => () => {
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    onNavigate(targetScreenOf(action, {}) ?? action.type, resolveParams(action.params, {}))
  }

  const pressButton = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
      return
    }
    if (spec.action.type === 'navigate') {
      onNavigate(navigateTarget(spec.action), resolveParams(spec.action.params, {}))
    }
  }

  const period = elementByNodeId(fin00, NODE.period).spec as SummarySpec
  const intro = elementByNodeId(fin00, NODE.intro).spec as SummarySpec
  const execution = elementByNodeId(fin00, NODE.execution).spec as SummarySpec
  const breakdown = elementByNodeId(fin00, NODE.breakdown).spec as ItemListSpec
  const recent = elementByNodeId(fin00, NODE.recent).spec as ItemListSpec
  const ledgerLink = elementByNodeId(fin00, NODE.ledgerLink).spec as ButtonSpec
  const proof = elementByNodeId(fin00, NODE.proof).spec as SummarySpec

  const scopeSource = getOptionSource(scopeSpec.optionsSource.key)
  const scopeOptions = scopeSource.type === 'static' ? scopeSource.options : []

  const breakdownRows = readListSource(
    breakdown.dataSourceKey,
    resolveParams(breakdown.params, { fields: { [scopeSpec.fieldKey]: scope } }),
  )
  const recentRows = readListSource(recent.dataSourceKey)
  const proofRow = readObjectSource(proof.dataSourceKey)

  // 집행률 묶음은 넉 줄을 한 출처에서 읽는다: 완성된 문구 둘과 막대의 두 마디.
  const [executionNote, plannedNote, spentBar, plannedBar] = execution.items ?? []
  const breadcrumb = fin00.breadcrumb

  return (
    <AppShell
      screenId={fin00.screenId}
      eyebrow={fin00.meta?.eyebrow}
      title={fin00.meta?.title ?? fin00.screenId}
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
        <span data-node-id={NODE.period} className="flex items-center gap-4">
          {(period.items ?? []).map((item, index) => (
            <span
              key={item.field}
              className={`block ${index === 0 ? '' : 'border-l border-gray-200 pl-4'}`}
            >
              <span className="block text-right text-xs text-gray-400">{item.label}</span>
              <span className="block pt-0.5 text-right text-xs font-semibold text-gray-700">
                {String(overview[item.field ?? ''])}
              </span>
            </span>
          ))}
        </span>
      }
    >
      <div data-node-id={NODE.intro}>
        <h2 className="text-lg font-semibold text-gray-900">{intro.title}</h2>
        <p className="pt-1 text-sm text-gray-500">{intro.description}</p>
      </div>

      {/* 금액 넷. 둘은 눌러 들어가는 카드다 — 그 사실은 명세의 action이 말한다. */}
      <div className="grid grid-cols-1 gap-4 pt-5 md:grid-cols-4">
        {cards.map((card) => {
          const spec = elementByNodeId(card.from, card.node).spec as SummarySpec
          const item = (spec.items ?? [])[0]
          const body = (
            <>
              <span className="flex items-center justify-between">
                <FigmaAsset screenId={card.screen} nodeId={card.asset} className="size-8" />
                {spec.action === undefined ? null : (
                  <span className="text-xs font-medium text-gray-400">
                    {spec.action.label}
                  </span>
                )}
              </span>
              <span className="block pt-3 text-xs font-medium text-gray-400">
                {spec.title}
              </span>
              <span
                data-design-rule="value-text"
                className={`block pt-1 text-xl font-bold ${
                  VALUE_TEXT[card.tone] ?? NEUTRAL_VALUE
                }`}
              >
                {String(overview[item?.field ?? ''])}
              </span>
              <span className={`block pt-1 text-xs text-gray-400 ${card.noteWeight}`}>
                {String(overview[item?.descriptionField ?? ''])}
              </span>
            </>
          )
          const className = 'block rounded-xl border border-gray-200 bg-white p-4 text-left'
          return spec.action === undefined ? (
            <div key={card.node} data-node-id={card.node} className={className}>
              {body}
            </div>
          ) : (
            <button
              key={card.node}
              type="button"
              data-node-id={card.node}
              onClick={press(spec.action)}
              className={`${className} hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none`}
            >
              {body}
            </button>
          )
        })}
      </div>

      {/* 집행률. 두 문장은 서버가 완성해 주고 화면은 막대만 그린다. */}
      <div
        data-node-id={NODE.execution}
        className="mt-4 rounded-xl border border-gray-200 bg-white p-5"
      >
        <div className="flex items-baseline gap-4">
          <span className="text-sm font-semibold text-gray-900">
            {String(overview[executionNote?.field ?? ''])}
          </span>
          <span className="text-sm font-medium text-gray-500">
            {String(overview[plannedNote?.field ?? ''])}
          </span>
        </div>
        {/* 마디 둘이 이어 붙는다 — 뒤 마디는 앞 마디에 더해지는 몫이다. */}
        <div className="mt-3 flex h-3.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full bg-blue-600"
            style={{ width: `${Number(overview[spentBar?.field ?? ''])}%` }}
          />
          <div
            className="h-full bg-blue-300"
            style={{ width: `${Number(overview[plannedBar?.field ?? ''])}%` }}
          />
        </div>
        <div className="flex items-center gap-4 pt-2">
          {[spentBar, plannedBar].map((item, index) => (
            <span key={item?.label} className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-blue-300'}`}
              />
              <span className="text-xs text-gray-500">{item?.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* 나누는 축. 고른 값은 목록의 조회 인자다 — 받아온 것을 화면에서 다시
            나누지 않는다. */}
        <div
          data-node-id={NODE.scope}
          role="tablist"
          aria-label={scopeSource.description}
          className="flex border border-gray-100 bg-gray-50 px-4"
        >
          {scopeOptions.map((option) => {
            const current = option.value === scope
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={current}
                onClick={() => setScope(option.value)}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${
                  current
                    ? 'border-blue-600 font-semibold text-blue-700'
                    : 'border-transparent font-medium text-gray-400'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <table data-node-id={NODE.breakdown} aria-label="구분별 예산 현황" className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {(breakdown.columns ?? []).map((column, index) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`px-5 py-2.5 text-xs font-semibold text-gray-500 ${
                    index === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdownRows.length === 0 ? (
              <tr>
                <td
                  colSpan={(breakdown.columns ?? []).length}
                  className="px-5 py-8 text-center text-sm text-gray-500"
                >
                  {findDataSource(breakdown.dataSourceKey).messages.empty}
                </td>
              </tr>
            ) : (
              breakdownRows.map((row) => (
                <tr
                  key={String(row.id)}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">
                    {String(row.name)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">
                    {String(row.budget)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">
                    {String(row.spent)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-600">
                    {String(row.planned)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-blue-600">
                    {String(row.available)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-1 w-14 overflow-hidden rounded-full bg-gray-100">
                        <span
                          className="block h-full rounded-full bg-blue-500"
                          style={{ width: `${Number(row.executionPercent)}%` }}
                        />
                      </span>
                      {/* 수는 데이터이고 %는 그 수를 읽는 말이다. */}
                      <span className="text-xs font-semibold text-gray-700">
                        {`${row.executionPercent}%`}
                      </span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <section
          data-node-id={NODE.recent}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <header className="flex items-center justify-between border border-gray-100 bg-gray-50 px-5 py-2.5">
            <h2 className="text-xs font-semibold text-gray-700">{recent.title}</h2>
            <button
              type="button"
              data-node-id={NODE.ledgerLink}
              onClick={pressButton(ledgerLink)}
              className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600"
            >
              {ledgerLink.label}
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.ledgerLink} className="size-3" />
            </button>
          </header>
          <table aria-label="최근 지출 내역" className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {(recent.columns ?? []).map((column, index) => (
                  <th
                    key={column.label}
                    scope="col"
                    className={`px-5 py-2.5 text-xs font-semibold text-gray-400 ${
                      index === 3 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={(recent.columns ?? []).length}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    {findDataSource(recent.dataSourceKey).messages.empty}
                  </td>
                </tr>
              ) : (
                recentRows.map((row) => (
                  <tr
                    key={String(row.id)}
                    className="border-b border-gray-50 last:border-b-0"
                  >
                    <td className="px-5 py-3 text-xs text-gray-500">{String(row.date)}</td>
                    <td className="px-5 py-3 text-xs font-medium text-gray-800">
                      {String(row.title)}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600">{String(row.context)}</td>
                    <td className="px-5 py-3 text-right text-xs font-semibold text-gray-900">
                      {String(row.amountNote)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        data-design-state
                        data-design-rule="table-state-chip"
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          TABLE_STATE_CHIP[String(row.proofTone)] ?? NEUTRAL_CHIP
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
        </section>

        <section
          data-node-id={NODE.proof}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <header className="border border-gray-100 bg-gray-50 px-5 py-2.5">
            <h2 className="text-xs font-semibold text-gray-700">{proof.title}</h2>
          </header>
          <div className="px-5 py-4">
            {(proof.items ?? []).map((item, index) => {
              const last = index === (proof.items ?? []).length - 1
              const tone = PROOF_TONE[item.field ?? '']
              return (
                <span
                  key={item.field}
                  className={`flex items-center justify-between ${
                    last ? 'mt-3 border-t border-gray-100 pt-3' : 'py-1.5'
                  }`}
                >
                  <span
                    className={
                      last ? 'text-xs font-semibold text-gray-700' : 'text-xs text-gray-500'
                    }
                  >
                    {item.label}
                  </span>
                  <span
                    data-design-rule="value-text"
                    className={`text-sm font-bold ${
                      tone === undefined ? NEUTRAL_VALUE : (VALUE_TEXT[tone] ?? NEUTRAL_VALUE)
                    }`}
                  >
                    {String(proofRow[item.field ?? ''])}
                  </span>
                </span>
              )
            })}
          </div>
        </section>
      </div>

      {note === null ? null : (
        <p role="status" className="pt-4 text-xs text-gray-500">
          {note}
        </p>
      )}
    </AppShell>
  )
}
