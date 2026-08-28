import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { MUTED_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import {
  findDataSource,
  readListSource,
  readObjectSource,
  readObjectSourceOrNull,
} from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, evtTask02 } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'

// 업무 상세(EVT-TASK-02).
//
// **이 화면은 인자를 받는다** — 지금까지의 열한 화면은 전부 인자가 없었다. 무엇의
// 상세인지는 화면 안 어디에도 없으므로 밖에서 와야 한다(screen.json의 params,
// 주소의 `?taskId=T-03`). 받지 못하면 조용히 아무 업무나 보여주지 않고 드러낸다.
//
// 갈피(탭) 하나는 아직 명세되지 않았다. 그 사실을 적을 자리가 명세에 없어
// 선택지의 부연 설명을 빌렸다(option-sources의 task.detailTab).

const SCREEN = 'EVT-TASK-02'

const NODE = {
  back: '25:1665',
  changeStatus: '25:1670',
  detail: '25:1682',
  tab: '25:1743',
  references: '25:1751',
  work: '25:1794',
  addFile: '25:1821',
  review: '25:1827',
} as const

const ASSET = {
  back: '25:1666',
  changeStatus: '25:1671',
  document: '25:1760',
  addFile: '25:1822',
  nextStep: '25:1849',
} as const

interface EVTTASK02ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string) => void
}

export function EVTTASK02Screen({ screenParams, onNavigate }: EVTTASK02ScreenProps) {
  const back = elementByNodeId(evtTask02, NODE.back).spec as ButtonSpec
  const changeStatus = elementByNodeId(evtTask02, NODE.changeStatus).spec as ButtonSpec
  const detailSpec = elementByNodeId(evtTask02, NODE.detail).spec as SummarySpec
  const tab = elementByNodeId(evtTask02, NODE.tab).spec as SelectSpec
  const references = elementByNodeId(evtTask02, NODE.references).spec as ItemListSpec
  const work = elementByNodeId(evtTask02, NODE.work).spec as ItemListSpec
  const addFile = elementByNodeId(evtTask02, NODE.addFile).spec as ButtonSpec
  const reviewSpec = elementByNodeId(evtTask02, NODE.review).spec as SummarySpec

  const [tabValue, setTabValue] = useState(tab.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const tabSource = getOptionSource(tab.optionsSource.key)
  const tabOptions = tabSource.type === 'static' ? tabSource.options : []
  const selectedTab = tabOptions.find((option) => String(option.value) === tabValue)

  // 명세가 요구한 인자가 없으면 조용히 아무 업무나 보여주지 않는다. 미등록 화면
  // 오류 카드와 같은 태도다 — 명세의 구멍을 숨기지 않는다.
  const missing = (evtTask02.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evtTask02.screenId}
        activeNavigationScreenId={evtTask02.activeNavigationScreenId}
        eyebrow={evtTask02.meta?.eyebrow}
        title={evtTask02.meta?.title ?? evtTask02.screenId}
        onNavigate={onNavigate}
      >
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  const argumentsOf = (params: SummarySpec['params']) =>
    resolveParams(params, { screenParams, fields: { [tab.fieldKey]: tabValue } })

  // 주소로는 아무 값이나 들어올 수 있다. 없는 업무를 물으면 터지는 대신
  // 카탈로그가 이미 갖고 있는 말로 답한다(messages.empty).
  const detail = readObjectSourceOrNull(
    detailSpec.dataSourceKey ?? '',
    argumentsOf(detailSpec.params),
  )
  if (detail === null) {
    return (
      <AppShell
        screenId={evtTask02.screenId}
        activeNavigationScreenId={evtTask02.activeNavigationScreenId}
        eyebrow={evtTask02.meta?.eyebrow}
        title={evtTask02.meta?.title ?? evtTask02.screenId}
        onNavigate={onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600"
        >
          {findDataSource(detailSpec.dataSourceKey ?? '').messages.empty}
        </p>
      </AppShell>
    )
  }
  const review = readObjectSource(reviewSpec.dataSourceKey ?? '', argumentsOf(reviewSpec.params))
  const referenceRows = readListSource(references.dataSourceKey, argumentsOf(references.params))
  const workRows = readListSource(work.dataSourceKey, argumentsOf(work.params))

  const pending = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
    }
  }

  return (
    <AppShell
      screenId={evtTask02.screenId}
      activeNavigationScreenId={evtTask02.activeNavigationScreenId}
      eyebrow={evtTask02.meta?.eyebrow}
      title={evtTask02.meta?.title ?? evtTask02.screenId}
      onNavigate={onNavigate}
      headerAction={
        <span className="flex items-center gap-2">
          <button
            type="button"
            data-node-id={NODE.back}
            onClick={pending(back)}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-3.5" />
            {back.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.changeStatus}
            onClick={pending(changeStatus)}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.changeStatus} className="size-3.5" />
            {changeStatus.label}
          </button>
        </span>
      }
    >
      {note === null ? null : (
        <p role="status" className="pb-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      {/* 업무 한 건. 라벨은 명세가, 값은 데이터가 갖는다. */}
      <div
        data-node-id={NODE.detail}
        className="rounded-xl border border-gray-200 bg-white px-6 py-5"
      >
        <span className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{String(detail.code)}</span>
          <Chip label={String(detail.status)} tone={String(detail.statusTone)} />
          <Chip label={String(detail.priority)} tone={String(detail.priorityTone)} />
        </span>
        <h2 className="pt-2 text-xl font-bold text-gray-900">
          {String(detail[detailSpec.titleField ?? ''])}
        </h2>

        {/* design은 카드 안을 옅은 선으로 두 칸으로 나눈다(25:1694·25:1721). */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            {(detailSpec.items ?? []).slice(0, 4).map((item) => (
              <span key={item.label}>
                <dt className="text-xs font-semibold text-gray-400">{item.label}</dt>
                <dd className="pt-1 text-sm text-gray-700">
                  {String(detail[item.field ?? ''])}
                </dd>
              </span>
            ))}
          </dl>
          {(detailSpec.items ?? []).slice(4, 5).map((item) => (
            <span key={item.label} className="block pt-4">
              <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
              <span className="block pt-1 text-sm text-gray-700">
                {String(detail[item.field ?? ''])}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          {(detailSpec.items ?? []).slice(5).map((item) => (
            <span key={item.label} className="block">
              <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
              <span className="block pt-1 text-sm text-gray-700">
                {String(detail[item.field ?? ''])}
              </span>
            </span>
          ))}
          <span className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
            <span>
              <span className="block text-xs font-semibold text-gray-400">예상 결과물</span>
              <span className="flex flex-wrap gap-2 pt-1.5">
                <span className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  {String(detail.expectedOutput)}
                </span>
              </span>
            </span>
            <span>
              <span className="block text-xs font-semibold text-gray-400">연결된 항목</span>
              {/* 개수가 업무마다 다르다 — 조각 중첩으로 온다. */}
              <span className="flex flex-wrap gap-2 pt-1.5">
                {((detail.linkedItems ?? []) as DataRow[]).map((linked) => (
                  <span
                    key={String(linked.label)}
                    className={`rounded px-2 py-1 text-xs font-medium ${MUTED_CHIP}`}
                  >
                    {String(linked.label)}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white">
        {/* 갈피. 지금까지의 탭은 목록을 다시 조회했지만 이것은 패널을 바꾼다. */}
        <div
          data-node-id={NODE.tab}
          role="radiogroup"
          aria-label={tab.label ?? '갈피'}
          className="flex gap-6 border-b border-gray-100 px-6"
        >
          {tabOptions.map((option) => {
            const value = String(option.value)
            const selected = value === tabValue
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTabValue(value)}
                className={`border-b-2 py-3.5 text-sm font-semibold ${
                  selected
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {tabValue !== 'documents' ? (
          <p role="status" className="px-6 py-10 text-center text-sm text-gray-500">
            {selectedTab?.description}
          </p>
        ) : (
          <div className="px-6 py-5">
            {/* 공식 참고 문서: 이 업무의 것이 아니라 행사의 공용 원본이다. */}
            <section data-node-id={NODE.references}>
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700">{references.title}</span>
                <span className={`rounded px-2 py-1 text-xs text-gray-400 ${MUTED_CHIP}`}>
                  행사 공용 원본 · 여러 업무에서 공유
                </span>
              </span>
              <ul className="flex flex-col gap-2 pt-3">
                {referenceRows.map((row) => (
                  <li
                    key={String(row.title)}
                    className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <FigmaAsset
                        screenId={SCREEN}
                        nodeId={ASSET.document}
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-800">
                          {String(row.title)}
                        </span>
                        <span className="block pt-0.5 text-xs text-gray-400">
                          {String(row.description)}
                        </span>
                        <span className="block pt-1.5 text-xs text-gray-400">
                          {String(row.lastModifiedNote)}
                        </span>
                      </span>
                    </span>
                    <Chip label={String(row.status)} tone={String(row.statusTone)} />
                  </li>
                ))}
              </ul>
            </section>

            {/* 작업 문서: 표로 그린다. 열 이름은 design이 정한 카피다. */}
            <section data-node-id={NODE.work} className="pt-6">
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700">{work.title}</span>
                <span className={`rounded px-2 py-1 text-xs text-gray-400 ${MUTED_CHIP}`}>
                  이 업무에서 작성 중
                </span>
              </span>
              {/* 표와 '파일 추가'를 함께 두른 칸에 테두리가 있다(25:1801). */}
              <div className="mt-3 rounded-lg border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-400">
                      <th className="px-3 py-2 font-bold">파일·문서명</th>
                      <th className="px-3 py-2 font-bold">유형</th>
                      <th className="px-3 py-2 font-bold">검토 상태</th>
                      <th className="px-3 py-2 font-bold">공식 문서 반영</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workRows.map((row) => (
                      <tr key={String(row.title)} className="border-t border-gray-50">
                        <td className="px-3 py-2.5 text-sm font-medium text-gray-800">{String(row.title)}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-500">{String(row.kind)}</td>
                        <td className="px-3 py-2.5">
                          <Chip label={String(row.status)} tone={String(row.statusTone)} />
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-400">
                          {String(row.officialReflection)}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  data-node-id={NODE.addFile}
                  onClick={pending(addFile)}
                  className="m-3 flex items-center gap-1.5 rounded-md border border-gray-100 bg-white px-3 py-2 text-xs font-medium text-gray-400 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.addFile} className="size-3.5" />
                  {addFile.label}
                </button>
              </div>
            </section>

            {/* 검토 현황: 값 묶음 하나다. */}
            <section data-node-id={NODE.review} className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <span className="block text-sm font-bold text-gray-700">{reviewSpec.title}</span>
              <span className="flex flex-wrap gap-6 pt-3">
                {(reviewSpec.items ?? []).slice(0, 2).map((item) => (
                  <span key={item.label} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">{item.label}</span>
                    <Chip
                      label={String(review[item.field ?? ''])}
                      tone={String(review[`${item.field}Tone`])}
                    />
                  </span>
                ))}
              </span>
              {(reviewSpec.items ?? []).slice(2).map((item) => (
                <span key={item.label} className="block pt-3">
                  <span className="block text-xs font-semibold text-gray-500">{item.label}</span>
                  <span className="block pt-1 text-sm text-yellow-800">
                    {String(review[item.field ?? ''])}
                  </span>
                </span>
              ))}
              <span className="flex items-center gap-1.5 pt-3 text-sm font-medium text-red-600">
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.nextStep} className="size-3.5" />
                {String(review.nextStepNote)}
              </span>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Chip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
        STATE_CHIP[tone] ?? NEUTRAL_CHIP
      }`}
    >
      {label}
    </span>
  )
}
