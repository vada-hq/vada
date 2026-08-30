import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
  STATE_CHIP,
} from '../design/tones'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow, DataValue } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { targetScreenOf, paramsOf } from '../spec/types'
import { drawnTitleOf, elementByNodeId, opsMeet09 } from '../spec/screens'
import type { SummarySpec } from '../spec/types'

// 취소된 회의 상세(OPS-MEET-09).
//
// **조작 단추가 하나도 없다.** 취소는 되돌릴 수 없기 때문이다(docs/decisions/
// meeting-model.md). 되돌리는 대신 새 회의를 만들어 잇고, 이 화면의 유일한
// 단추는 그 대체 회의로 가는 문이다.
//
// 상태를 화면이 알지 않는다 — '취소'라는 말도, 띠의 제목과 본문도 서버가 준다
// (meeting.detail의 status·stateBannerTitle·stateBannerNote). 여기서 상태 이름을
// 코드에 적으면 상태가 하나 늘 때 이 화면이 조용히 틀린다.
//
// 다만 **띠의 색은 명세가 가리키는 자리가 없어** design이 그린 그대로 붉게
// 그린다. meeting.detail은 stateBannerTone을 갖는데 summary에는 그 이름을 담을
// 칸이 없다. 이 화면이 취소된 회의만 그리는 자리라 어긋나지 않을 뿐이므로,
// 띠를 여러 상태가 나눠 쓰게 되면 스키마에 자리를 내야 한다.

const SCREEN = 'OPS-MEET-09'

const NODE = {
  banner: '20:2719',
  meeting: '20:2732',
  cancellation: '20:2754',
  replacement: '20:2771',
} as const

// 어느 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다.
const ASSET = {
  cancelled: '20:2720',
  openReplacement: '20:2779',
} as const

// 경로 조각 사이의 화살표. 조각보다 하나 적다.
const BREADCRUMB_SEPARATORS = ['20:2705', '20:2710']

interface OPSMEET09ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function scalar(row: DataRow, field: string | undefined): string {
  const value: DataValue | undefined = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-09의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function OPSMEET09Screen({ screenParams, onNavigate }: OPSMEET09ScreenProps) {
  const [notice, setNotice] = useState<string | null>(null)

  const banner = elementByNodeId(opsMeet09, NODE.banner).spec as SummarySpec
  const meeting = elementByNodeId(opsMeet09, NODE.meeting).spec as SummarySpec
  const cancellation = elementByNodeId(opsMeet09, NODE.cancellation).spec as SummarySpec
  const replacement = elementByNodeId(opsMeet09, NODE.replacement).spec as SummarySpec

  const meta = opsMeet09.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-09의 화면 카피가 없습니다.')
  }

  // 인자가 없으면 조용히 아무 회의나 보여주지 않는다. FIN-REQ-02·EVT-TASK-02와
  // 같은 태도다 — 명세의 구멍도 사람의 실수도 숨기지 않는다.
  const missingParam = (opsMeet09.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )

  const query = resolveParams(banner.params, { screenParams })
  // 아직 무엇을 물을지 모르는 동안에는 묻지 않는다. 인자가 비면 출처가 첫 줄을
  // 집어 오게 되어 남의 회의를 자기 것으로 읽는다.
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(banner.dataSourceKey ?? '', query)
      : null

  // 띠의 색 이름은 명세가 가리킨 조각에서 온다. 상태가 색을 정하는데 상태는
  // 조직이 늘릴 수 있어서, 화면이 목록을 들고 있으면 늘 때마다 틀린다.
  const bannerTone = detail === null ? '' : scalar(detail, banner.toneField ?? '')

  if (missingParam !== undefined || detail === null) {
    return (
      <AppShell
        screenId={opsMeet09.screenId}
        activeNavigationScreenId={opsMeet09.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(banner.dataSourceKey ?? '').messages.empty}
        </p>
      </AppShell>
    )
  }

  const breadcrumb = opsMeet09.breadcrumb

  // 대체 회의로 가는 문은 그 카드가 갖는다 — 단추가 카드 **안에** 그려져 있어
  // 따로 등록할 자리가 아니다(design의 20:2777 ⊂ 20:2771).
  //
  // 어느 회의로 가는지는 이 회의가 안다. 대체 회의의 id는 화면의 입력 칸에도
  // 주소에도 없고, 이 화면이 읽은 한 건의 조각이다(sourceField).
  const replacementAction = replacement.action
  function pressOpenReplacement() {
    if (replacementAction === undefined) return
    if (replacementAction.type === 'pending') {
      setNotice(replacementAction.note)
      return
    }
    onNavigate(
      targetScreenOf(replacementAction, detail ?? {}) ?? replacementAction.type,
      resolveParams(paramsOf(replacementAction), { screenParams, row: detail ?? undefined }),
    )
  }

  return (
    <AppShell
      screenId={opsMeet09.screenId}
      activeNavigationScreenId={opsMeet09.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={drawnTitleOf(opsMeet09, screenParams)}
      description={meta.description}
      footerNote={meta.footerNote}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={opsMeet09.screenId}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined ? (item.value ?? '') : scalar(detail, item.field),
            )}
          />
        )
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[968px] flex-col gap-5">
        {/* 상태 띠 20:2719. 제목·본문·딱지가 모두 데이터다 — 이 화면이 아는 것은
            그것들이 여기 그려진다는 사실뿐이다. */}
        <section
          data-node-id={NODE.banner}
          data-design-rule="state-banner"
          className={`flex items-start gap-2.5 rounded-xl border p-5 ${
            BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
          }`}
        >
          <FigmaAsset
            screenId={SCREEN}
            nodeId={ASSET.cancelled}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span
                data-design-rule="state-banner"
                className={`text-xs font-bold ${BANNER_TEXT[bannerTone]?.title ?? NEUTRAL_VALUE}`}
              >
                {scalar(detail, banner.titleField)}
              </span>
              {(banner.status ?? []).map((chip) => (
                <span
                  key={chip.field}
                  data-design-state
                  data-design-rule="state-chip"
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    STATE_CHIP[scalar(detail, chip.toneField)] ?? NEUTRAL_CHIP
                  }`}
                >
                  {scalar(detail, chip.field)}
                </span>
              ))}
            </span>
            <span
              data-design-rule="state-banner"
              className={`block pt-1.5 text-xs ${BANNER_TEXT[bannerTone]?.note ?? NEUTRAL_VALUE}`}
            >
              {scalar(detail, banner.descriptionField)}
            </span>
          </span>
        </section>

        {/* 회의 한 건 20:2732. 라벨은 명세가, 값은 데이터가 갖는다. 일시의 라벨이
            '원래 예정 일시'인 것은 이 화면의 카피이지 조각 이름이 아니다. */}
        <section
          data-node-id={NODE.meeting}
          className="rounded-xl border border-gray-200 bg-white p-6"
        >
          <h2 className="text-lg font-bold text-gray-900">{scalar(detail, meeting.titleField)}</h2>
          <p className="pt-2 text-xs text-gray-500">
            {scalar(detail, meeting.descriptionField)}
          </p>
          <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3">
            {(meeting.items ?? []).map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-gray-400">{item.label}</dt>
                <dd className="pt-1 text-xs font-semibold text-gray-800">
                  {scalar(detail, item.field)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 취소 기록 20:2754. 항목 수가 명세에 고정이라 summary다 — 취소는 한 번
            일어난 일이지 되풀이되는 목록이 아니다. */}
        <section
          data-node-id={NODE.cancellation}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-900">{cancellation.title}</h2>
          </div>
          {/* design은 두 칸을 다르게 그린다 — 왼쪽은 여러 줄로 흐르는 사유이고
              오른쪽은 누가 언제인지를 짧게 짚는다. 그래서 값의 색·굵기가 다르다. */}
          <dl className="grid grid-cols-1 sm:grid-cols-2">
            {(cancellation.items ?? []).map((item, at) => (
              <div key={item.label} className={at === 0 ? 'p-5' : 'border-l border-gray-100 p-5'}>
                <dt className="text-xs text-gray-400">{item.label}</dt>
                <dd className="pt-1.5">
                  <span
                    className={`block text-xs ${
                      at === 0 ? 'leading-6 text-gray-700' : 'font-semibold text-gray-800'
                    }`}
                  >
                    {scalar(detail, item.field)}
                  </span>
                  {item.descriptionField === undefined ? null : (
                    <span className="block pt-1 text-xs text-gray-500">
                      {scalar(detail, item.descriptionField)}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 대체 회의 20:2771. 취소를 되돌리는 대신 새 회의로 잇는 자리다. */}
        <section
          data-node-id={NODE.replacement}
          className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-white p-5"
        >
          <span className="min-w-0">
            <span className="block text-xs font-bold text-gray-800">{replacement.title}</span>
            <span className="block pt-1 text-xs text-gray-500">
              {scalar(detail, replacement.descriptionField)}
            </span>
          </span>
          {/* 이 문은 카드의 동작이다 — design이 단추를 카드 **안에** 그렸으므로
              따로 등록할 자리가 아니다(20:2777 ⊂ 20:2771). */}
          <button
            type="button"
            onClick={pressOpenReplacement}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {replacementAction?.label}
            <FigmaAsset
              screenId={SCREEN}
              nodeId={ASSET.openReplacement}
              className="size-3 shrink-0"
            />
          </button>
        </section>

        {notice === null ? null : (
          <p role="status" className="text-xs font-medium text-gray-500">
            {notice}
          </p>
        )}
      </div>
    </AppShell>
  )
}
