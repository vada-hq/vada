import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import {
  CALENDAR_CHIP,
  CALENDAR_DAY,
  CALENDAR_FILTER_ON,
  CALENDAR_TYPE_DOT,
  CALENDAR_TYPE_FILTER,
  CHOICE_CHIP,
  NEUTRAL_CHIP,
} from '../design/tones'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, opsCal01 } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import type { ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'

// 운영 캘린더(OPS-CAL-01).
//
// **읽기만 하는 화면이다.** 바닥 글이 그것을 못 박는다 — 회의는 운영 > 회의에서,
// 행사 일정은 각 행사의 일정 탭에서 만든다. 여기 그려지는 것은 그 원본들이 한
// 격자에 비친 것이다(EVT-SCHED-01의 목록과 같은 성질이다).
//
// ── 명세가 침묵한 자리 둘 ──────────────────────────────────────────────────
//
// **달을 앞뒤로 옮기는 조작(design 30:2106 '이전 달' · 30:2112 '다음 달')을
// 그리지 않는다.** 명세에 그 조작을 담을 어휘가 없다: itemList.paging은
// pageCountField가 필수인데 달은 끝이 없고, select로 적으면 디자인이 그리지 않은
// 목록을 명세가 지어내는 것이며, pending은 '아직 정해지지 않았다'는 뜻이라
// 거짓말이다(정해져 있고, 적을 말이 없을 뿐이다). 어휘를 이 화면 하나 때문에
// 만들지 않기로 했으므로 **화면도 그 조작을 갖지 않는다** — 명세가 모르는 것을
// 화면이 알면 그것이 바로 교차 검증이 잡아낸 결함 계급이다. 그래서 지금 보고
// 있는 달은 서버가 정한다(ops.calendarMonth에 인자가 없다).
//
// **딱지 안의 '행사 일정 보기' 아이콘 단추(30:2236 등)를 그리지 않는다.**
// 한 항목에 동작이 둘인데 itemList.itemAction은 하나뿐이다. 제목 단추만
// 명세했고, 아이콘 단추는 명세에 자리가 없어 남겨 두었다. 그림을 그려 두면
// 눌러도 아무 일이 없는 단추가 되므로 그리지 않고, 그 어긋남은 숨기지 않고
// design/deviations.ts에 적는다.
//
// 이번 주 목록은 사정이 다르다. 거기서는 줄 전체와 '행사 일정 보기' 링크가 같은
// 줄에만 함께 있으므로 **동작이 하나**이고, 그 하나를 명세가 갖는다.

const SCREEN = 'OPS-CAL-01'

const NODE = {
  breadcrumb: '30:2090',
  month: '30:2110',
  filter: '30:2117',
  legend: '30:2126',
  grid: '30:2141',
  weekHeader: '30:2363',
  week: '30:2368',
} as const

const ASSET = {
  breadcrumbSeparator: '30:2094',
  // 줄마다 같은 그림(들어가기)이 다른 노드로 있다. 첫 줄의 것만 지목한다.
  weekEnter: '30:2374',
} as const

// 요일 머리(30:2144~30:2156). **명세에 없다** — 달력 격자가 요일 줄을 갖는 것은
// 그리는 방법이지 계약이 아니다(표인지 시간 줄인지를 명세가 말하지 않는 것과 같은
// 자리다). 그래도 색은 지어내지 않는다: design이 정하고 대조기가 지킨다.
const WEEKDAYS = [
  { label: '일', className: 'text-red-400' },
  { label: '월', className: 'text-gray-400' },
  { label: '화', className: 'text-gray-400' },
  { label: '수', className: 'text-gray-400' },
  { label: '목', className: 'text-gray-400' },
  { label: '금', className: 'text-gray-400' },
  { label: '토', className: 'text-blue-400' },
] as const

interface OPSCAL01ScreenProps {
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function OPSCAL01Screen({ onNavigate }: OPSCAL01ScreenProps) {
  const filterSpec = elementByNodeId(opsCal01, NODE.filter).spec as SelectSpec
  const [calendarType, setCalendarType] = useState(filterSpec.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const monthSpec = elementByNodeId(opsCal01, NODE.month).spec as SummarySpec
  const legendSpec = elementByNodeId(opsCal01, NODE.legend).spec as SummarySpec
  const gridSpec = elementByNodeId(opsCal01, NODE.grid).spec as ItemListSpec
  const weekHeaderSpec = elementByNodeId(opsCal01, NODE.weekHeader).spec as SummarySpec
  const weekSpec = elementByNodeId(opsCal01, NODE.week).spec as ItemListSpec

  const optionSource = getOptionSource(filterSpec.optionsSource.key)
  const options = optionSource.type === 'static' ? optionSource.options : []

  // 유형의 열쇠는 필터의 선택지가 갖고 있다. 범례는 그 유형을 사람이 읽는 글로
  // 다시 적어 둔 것이라(고정 카피), 글이 같은 선택지를 찾아 색을 얻는다 —
  // 화면이 '행사는 초록'이라고 따로 적어 두면 그것이 두 번째 진실이 된다.
  const typeKeyOf = (label: string) =>
    options.find((option) => option.label === label)?.value ?? ''

  // 거르는 값은 조회 인자다. 받아온 것을 화면에서 다시 거르지 않는다.
  const fields = { [filterSpec.fieldKey]: calendarType }
  const monthRow = readObjectSource(monthSpec.dataSourceKey ?? '')
  const weekRangeRow = readObjectSource(weekHeaderSpec.dataSourceKey ?? '')
  const days = readListSource(
    gridSpec.dataSourceKey,
    resolveParams(gridSpec.params, { fields }),
  )
  const weekRows = readListSource(
    weekSpec.dataSourceKey,
    resolveParams(weekSpec.params, { fields }),
  )

  const dayField = gridSpec.group?.headerFields?.[0]
  const chipColumn = (gridSpec.columns ?? [])[0]
  const [typeColumn, dateColumn, titleColumn] = weekSpec.columns ?? []

  const breadcrumb = opsCal01.breadcrumb

  return (
    <AppShell
      screenId={opsCal01.screenId}
      activeNavigationScreenId={opsCal01.activeNavigationScreenId}
      eyebrow={opsCal01.meta?.eyebrow}
      title={opsCal01.meta?.title ?? opsCal01.screenId}
      description={opsCal01.meta?.description}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 지금 보고 있는 달. 앞뒤로 옮기는 단추는 위 주석의 이유로 없다. */}
        <p data-node-id={NODE.month} className="text-sm font-bold text-gray-900">
          {String(monthRow[monthSpec.titleField ?? ''])}
        </p>

        <div
          data-node-id={NODE.filter}
          role="radiogroup"
          aria-label={optionSource.description}
          className="flex flex-wrap gap-2"
        >
          {options.map((option) => {
            const value = String(option.value)
            const selected = value === calendarType
            // 고른 것은 유형과 무관하게 무채색으로 채운다(30:2118). 안 고른 것은
            // 제 유형의 옅은 색이고, '전체'는 유형이 아니므로 무채색 테두리다.
            const tone = selected
              ? CALENDAR_FILTER_ON
              : (CALENDAR_TYPE_FILTER[value] ?? CHOICE_CHIP.off)
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setCalendarType(value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        data-node-id={NODE.legend}
        className="flex flex-wrap items-center gap-4 pt-4 text-xs"
      >
        <span className="font-semibold text-gray-600">{legendSpec.title}</span>
        {(legendSpec.items ?? []).map((item) => (
          <span key={item.value} className="flex items-center gap-1.5 text-gray-500">
            <span
              className={`size-2 rounded-full ${
                CALENDAR_TYPE_DOT[typeKeyOf(item.value ?? '')] ?? 'bg-gray-300'
              }`}
            />
            {item.value}
          </span>
        ))}
        <span className="text-gray-400">{legendSpec.description}</span>
      </div>

      {note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      <div className="flex flex-col gap-4 pt-4 lg:flex-row">
        {/* 월 격자. 묶음 하나가 하루이고 그 안이 그날의 일정이다. */}
        <div
          data-node-id={NODE.grid}
          className="min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <div className="grid grid-cols-7 border border-gray-100 bg-gray-50">
            {WEEKDAYS.map((weekday) => (
              <span
                key={weekday.label}
                className={`px-2 py-1.5 text-center text-xs font-bold ${weekday.className}`}
              >
                {weekday.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const label = String(day[dayField?.fields?.[0] ?? ''])
              const tone = String(day[dayField?.toneField ?? ''])
              const schedules = (day[gridSpec.group?.itemsField ?? ''] ?? []) as DataRow[]
              return (
                <div
                  key={String(day.id)}
                  className={`min-h-20 border border-gray-50 p-1 ${
                    label === '' ? 'bg-gray-50' : ''
                  }`}
                >
                  {label === '' ? null : (
                    <span
                      className={`inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold ${
                        CALENDAR_DAY[tone] ?? CALENDAR_DAY.gray
                      }`}
                    >
                      {label}
                    </span>
                  )}
                  <span className="mt-1 flex flex-col gap-1">
                    {schedules.map((schedule) => (
                      <button
                        key={String(schedule.id)}
                        type="button"
                        onClick={() => {
                          const action = gridSpec.itemAction
                          if (action?.type === 'pending') setNote(action.note)
                        }}
                        aria-label={`${String(
                          schedule[chipColumn?.fields?.[0] ?? ''],
                        )} ${gridSpec.itemAction?.label ?? ''}`}
                        className={`w-full rounded border px-1.5 py-1 text-left text-[10px] font-semibold ${
                          CALENDAR_CHIP[String(schedule[chipColumn?.toneField ?? ''])] ??
                          NEUTRAL_CHIP
                        }`}
                      >
                        {String(schedule[chipColumn?.fields?.[0] ?? ''])}
                      </button>
                    ))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 이번 주 일정. 보고 있는 달과 무관하다 — '이번 주'는 오늘이 정한다. */}
        <aside className="w-full shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white lg:w-72">
          <div data-node-id={NODE.weekHeader} className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold text-gray-800">{weekHeaderSpec.title}</p>
            {(weekHeaderSpec.items ?? []).map((item) => (
              <p key={item.field} className="pt-0.5 text-xs text-gray-400">
                {String(weekRangeRow[item.field ?? ''])}
              </p>
            ))}
          </div>

          <ul data-node-id={NODE.week} className="flex flex-col gap-2 p-2.5">
            {weekRows.map((row) => (
              <li
                key={String(row.id)}
                className="flex flex-col border border-gray-100 px-2.5 py-2.5"
              >
                {/* 갈 곳이 있는 줄만 문구가 온다(EVT-02의 확인 항목과 같은 자리).
                    design은 이 링크를 줄 아래에 두지만 노드 차례로는 먼저다 —
                    대조가 줄의 글을 그 차례로 찾으므로 DOM도 그 차례를 따르고
                    보이는 자리만 order로 내린다. */}
                {row[weekSpec.itemAction?.labelField ?? ''] === undefined ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      const action = weekSpec.itemAction
                      if (action === undefined) return
                      if (action.type === 'pending') {
                        setNote(action.note)
                        return
                      }
                      const target = targetScreenOf(action, row)
                      if (target === null) return
                      onNavigate(target, resolveParams(action.params, { row }))
                    }}
                    className="order-last flex items-center gap-1.5 pt-2 text-left text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <FigmaAsset
                      screenId={SCREEN}
                      nodeId={ASSET.weekEnter}
                      className="size-3 shrink-0"
                    />
                    {String(row[weekSpec.itemAction?.labelField ?? ''])}
                  </button>
                )}
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                      CALENDAR_CHIP[String(row[typeColumn?.toneField ?? ''])] ?? NEUTRAL_CHIP
                    }`}
                  >
                    {String(row[typeColumn?.fields?.[0] ?? ''])}
                  </span>
                  <span className="text-xs text-gray-400">
                    {String(row[dateColumn?.fields?.[0] ?? ''])}
                  </span>
                </span>
                <span className="pt-2 text-xs font-semibold text-gray-800">
                  {String(row[titleColumn?.fields?.[0] ?? ''])}
                </span>
              </li>
            ))}
          </ul>

          {/* 바닥 글은 design이 이 칸 안에 그렸다(30:2472). AppShell의 자리가
              아니라 여기다 — 무엇을 어디서 만드는지가 이 목록의 곁말이다. */}
          {opsCal01.meta?.footerNote && (
            <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
              {opsCal01.meta.footerNote}
            </p>
          )}
        </aside>
      </div>
    </AppShell>
  )
}
