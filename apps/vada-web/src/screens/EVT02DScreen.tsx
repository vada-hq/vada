import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
  SOFT_BOX,
  STATE_CHIP,
  VALUE_TEXT,
} from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evt02d } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import type { ItemListSpec, SummarySpec } from '../spec/types'

// 행사 개요 — 후속 정리 중(EVT-02D).
//
// EVT-02(기획 중)와 **다른 화면이다.** 같은 갈피('개요')에서 열리지만 겹치는 것이
// 둘뿐이고 그 둘조차 다르다 — 기본 정보가 일곱 칸에서 네 칸으로 줄고 `참석자`라는
// 칸이 새로 생긴다. 회의가 상태로 화면을 가른 것과 같은 자리다
// (docs/decisions/meeting-model.md).
//
// **상태 이름도, 누가 무엇을 할 수 있는지도 이 화면이 알지 않는다.** '후속 정리 중'과
// '행사 완료 처리는 회장단만 할 수 있습니다.'는 서버가 준다(event.wrapUpBanner의
// stateLabel·permissionNote). 여기 적으면 단계가 하나 늘거나 권한이 바뀔 때마다
// 이 화면이 조용히 틀린다.
//
// 읽기만 하는 화면이다. 남은 것을 고치는 자리는 전부 다른 화면이다(업무 보드·문서·
// 관련 회의).

const SCREEN = 'EVT-02D'

const NODE = {
  state: '20:5829',
  banner: '20:5834',
  countsTitle: '20:5848',
  counts: ['20:5851', '20:5859', '20:5867', '20:5875'],
  basics: '20:5881',
  remaining: '20:5907',
  changes: '20:5989',
} as const

const ASSET = {
  banner: '20:5835',
  workspaceStatus: { startAt: '20:5816' } as Record<string, string>,
  // 남은 항목의 아이콘은 그 항목이 얼마나 급한지가 정한다. 순서에 기대지 않는다 —
  // 개수도 순서도 데이터가 정하기 때문이다(EVT-02의 확인 항목과 같은 판단이다).
  remainingByTone: {
    gray: '20:5912',
    red: '20:5925',
  } as Record<string, string>,
} as const

interface EVT02DScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT02DScreen({ screenParams, onNavigate }: EVT02DScreenProps) {
  const [note, setNote] = useState<string | null>(null)

  const missing = (evt02d.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt02d.screenId}
        activeNavigationScreenId={evt02d.activeNavigationScreenId}
        eyebrow={evt02d.meta?.eyebrow}
        title={evt02d.meta?.title ?? evt02d.screenId}
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

  const argumentsOf = (params: SummarySpec['params']) => resolveParams(params, { screenParams })
  const readSummary = (nodeId: string) => {
    const spec = elementByNodeId(evt02d, nodeId).spec as SummarySpec
    return {
      spec,
      row: readObjectSource(spec.dataSourceKey ?? '', argumentsOf(spec.params)),
    }
  }

  const state = readSummary(NODE.state)
  const banner = readSummary(NODE.banner)
  const basics = readSummary(NODE.basics)
  const countsTitle = elementByNodeId(evt02d, NODE.countsTitle).spec as SummarySpec
  const remainingSpec = elementByNodeId(evt02d, NODE.remaining).spec as ItemListSpec
  const changesSpec = elementByNodeId(evt02d, NODE.changes).spec as ItemListSpec
  const remaining = readListSource(
    remainingSpec.dataSourceKey,
    argumentsOf(remainingSpec.params),
  )
  const changes = readListSource(changesSpec.dataSourceKey, argumentsOf(changesSpec.params))

  // 띠 자체의 색 이름은 명세가 가리킨 조각에서 온다. 단계가 색을 정하는데 단계는
  // 조직 운영이 늘릴 수 있어서, 화면이 목록을 들고 있으면 늘 때마다 틀린다.
  const bannerTone = String(banner.row[banner.spec.toneField ?? ''])

  // 목록의 어느 조각이 주 문구이고 어느 것이 보조인지는 명세가 말한다. 출처의
  // 조각 이름을 화면이 뒤져 고르면 그것은 명세가 아니라 짐작이다.
  const columnField = (spec: ItemListSpec, at: number) =>
    (spec.columns ?? [])[at]?.fields?.[0] ?? ''

  return (
    <AppShell
      screenId={evt02d.screenId}
      activeNavigationScreenId={evt02d.activeNavigationScreenId}
      eyebrow={evt02d.meta?.eyebrow}
      title={drawnTitleOf(evt02d, screenParams)}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evt02d}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />

      {note === null ? null : (
        <p role="status" className="pt-4 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      {/* 단계 줄 20:5829. 딱지의 말도 색도, 그 곁의 안내도 전부 서버가 준다 —
          '행사 완료 처리는 회장단만 할 수 있습니다'를 화면이 적으면 권한이 바뀔 때
          화면이 틀린다. */}
      <div data-node-id={NODE.state} className="flex flex-wrap items-center gap-3 pt-6">
        {(state.spec.status ?? []).map((chip) => (
          <span
            key={chip.field}
            data-design-state
            data-design-rule="state-chip"
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              STATE_CHIP[String(state.row[chip.toneField])] ?? NEUTRAL_CHIP
            }`}
          >
            {String(state.row[chip.field])}
          </span>
        ))}
        {(state.spec.items ?? []).map((item) => (
          <span key={item.field} className="text-xs text-gray-400">
            {String(state.row[item.field ?? ''])}
          </span>
        ))}
      </div>

      {/* 띠 20:5834. 라벨이 없다 — 서버가 문장을 완성해 준다. */}
      <div
        data-node-id={NODE.banner}
        data-design-rule="state-banner"
        className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${
          BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
        }`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0">
          <span
            data-design-rule="state-banner"
            className={`block text-sm font-semibold ${
              BANNER_TEXT[bannerTone]?.title ?? NEUTRAL_VALUE
            }`}
          >
            {String(banner.row[banner.spec.titleField ?? ''])}
          </span>
          <span
            data-design-rule="state-banner"
            className={`block pt-1 text-xs ${BANNER_TEXT[bannerTone]?.note ?? NEUTRAL_VALUE}`}
          >
            {String(banner.row[banner.spec.descriptionField ?? ''])}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-3 lg:grid-cols-[334fr_685fr]">
        <div className="flex flex-col gap-3">
          {/* 후속 정리 현황. 타일 넷은 각자 제 요소다 — 색도 가는 곳도 따로이기
              때문이다. 그래서 섹션 제목이 기댈 요소가 없어 제목이 스스로 요소다
              (OPS-MEET-06A의 '현재 정리 현황'과 같은 자리). */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 data-node-id={NODE.countsTitle} className="text-sm font-semibold text-gray-700">
              {countsTitle.title}
            </h2>
            <div className="flex flex-col gap-2 pt-2">
              {NODE.counts.map((nodeId) => {
                const spec = elementByNodeId(evt02d, nodeId).spec as SummarySpec
                const row = readObjectSource(spec.dataSourceKey ?? '', argumentsOf(spec.params))
                const item = (spec.items ?? [])[0]
                const tone = String(row[spec.toneField ?? ''])
                const action = spec.action
                return (
                  <div
                    key={nodeId}
                    data-node-id={nodeId}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                      SOFT_BOX[tone] ?? NEUTRAL_BORDER
                    }`}
                  >
                    {/* 라벨은 무채색이고 색이 붙는 것은 값뿐이다. */}
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-500">{item?.label}</span>
                      <span
                        data-design-rule="value-text"
                        className={`block pt-1 text-sm font-bold ${
                          VALUE_TEXT[tone] ?? NEUTRAL_VALUE
                        }`}
                      >
                        {String(row[item?.field ?? ''])}
                      </span>
                    </span>
                    {/* 갈 곳이 있는 타일만 문구를 갖는다 — 확인 필요 참가자에는
                        design이 단추를 그리지 않았다. */}
                    {action === undefined ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          if (action.type === 'pending') {
                            setNote(action.note)
                            return
                          }
                          onNavigate(
                            targetScreenOf(action, row) ?? action.type,
                            resolveParams(action.params, { screenParams }),
                          )
                        }}
                        className="shrink-0 text-xs font-medium text-blue-500 hover:text-blue-700"
                      >
                        {`${action.label} →`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* 행사 기본 정보 20:5881. EVT-02는 일곱 칸인데 여기는 넷이고 `참석자`가
              새로 온다 — 행사가 끝나야 셀 수 있는 값이라 이 단계부터 온다. */}
          <section
            data-node-id={NODE.basics}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-gray-700">{basics.spec.title}</h2>
            <dl className="pt-2">
              {(basics.spec.items ?? []).map((item) => (
                <span key={item.label} className="flex gap-3 py-1.5">
                  <dt className="w-20 shrink-0 text-xs text-gray-400">{item.label}</dt>
                  <dd className="text-xs text-gray-700">{String(basics.row[item.field ?? ''])}</dd>
                </span>
              ))}
            </dl>
          </section>
        </div>

        <div className="flex flex-col gap-3">
          {/* 남은 항목 상세 20:5907. 줄마다 그 원본으로 간다. */}
          <section
            data-node-id={NODE.remaining}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-gray-700">{remainingSpec.title}</h2>
            {remaining.length === 0 ? (
              <p data-design-state="empty" className="py-6 text-center text-xs text-gray-400">
                {findDataSource(remainingSpec.dataSourceKey).messages.empty}
              </p>
            ) : (
              <ul className="pt-2">
                {remaining.map((row) => (
                  <li
                    key={String(row.id)}
                    className="flex items-start gap-3 rounded border border-gray-50 py-2.5"
                  >
                    <FigmaAsset
                      screenId={SCREEN}
                      nodeId={
                        ASSET.remainingByTone[String(row.tone)] ?? ASSET.remainingByTone.gray
                      }
                      className="mt-0.5 size-3"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-gray-800">
                        {String(row[columnField(remainingSpec, 0)])}
                      </span>
                      <span className="block pt-1 text-xs text-gray-400">
                        {String(row[columnField(remainingSpec, 1)])}
                      </span>
                    </span>
                    {remainingSpec.itemAction === undefined ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          const action = remainingSpec.itemAction
                          if (action === undefined) return
                          if (action.type === 'pending') {
                            setNote(action.note)
                            return
                          }
                          onNavigate(
                            targetScreenOf(action, row) ?? action.type,
                            resolveParams(action.params, { screenParams, row }),
                          )
                        }}
                        className="shrink-0 text-xs font-medium text-blue-500 hover:text-blue-700"
                      >
                        {`${remainingSpec.itemAction?.label} →`}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 최근 변경 사항 20:5989. 비었다는 말은 화면이 짓지 않는다 — 카탈로그의
              messages.empty가 이미 갖고 있다. */}
          <section
            data-node-id={NODE.changes}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-gray-700">{changesSpec.title}</h2>
            {changes.length === 0 ? (
              <p data-design-state="empty" className="py-6 text-center text-xs text-gray-400">
                {findDataSource(changesSpec.dataSourceKey).messages.empty}
              </p>
            ) : (
              <ul className="pt-2">
                {changes.map((row) => (
                  <li key={String(row[columnField(changesSpec, 1)])} className="flex gap-3 py-1">
                    <span className="w-20 shrink-0 text-xs text-gray-400">
                      {String(row[columnField(changesSpec, 0)])}
                    </span>
                    <span className="text-xs text-gray-700">
                      {String(row[columnField(changesSpec, 1)])}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  )
}
