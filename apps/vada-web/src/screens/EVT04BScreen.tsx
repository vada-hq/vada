import { useState } from 'react'
import type { ReactNode } from 'react'
import { DANGER_BUTTON, STATE_CHIP } from '../design/tones'
import { FigmaAsset } from '../components/FigmaAsset'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, evt04b } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, SubmitAction, SummarySpec } from '../spec/types'
import { EVT04Screen } from './EVT04Screen'

// 참석 확인 QR(EVT-04B). 행사 참가자 명단(EVT-04) 위에 뜨는 모달이다.
//
// **QR은 행사 상태와 따로 켜고 끈다**(data-sources.json의 event.attendanceQr).
// 그래서 이 모달은 뒤 화면의 상태를 한 줄도 읽지 않는다 - 기획 중인 행사도 QR을
// 미리 만들 수 있고, 진행 중인 행사의 QR을 끌 수도 있다. 상태 딱지의 글도 색도
// 서버가 준다(statusLabel·statusTone): '활성 중' 말고 무엇이 더 있는지는 명세가
// 들고 있을 수 없다.
//
// 체크인 시작·종료는 **읽는 값이다.** 카탈로그가 그 둘을 event.attendanceQr의
// 조각으로만 두었고 그것을 고쳐 보내는 변이가 없다(regenerate·deactivate 둘뿐).
// design이 빈 DateTime Picker로 그렸다고 화면이 고칠 수 있게 만들면, 명세에 없는
// 저장 경로를 화면이 지어내는 셈이 된다.
//
// 단추 셋이 서로 다른 종류다.
// · QR 다운로드는 download다. pending이 아니다 - 무엇을 받아 가는지 정해져 있고,
//   명세가 아는 것은 '어느 파일인가'까지다(fileName). 이 저장소에는 파일을 건네줄
//   곳이 아직 없으므로 어느 파일인지만 드러낸다(OPS-MEET-07과 같은 자리).
// · 재생성·비활성화는 submit이고 **보내고 그 자리에 머문다**(onSuccess가 비어
//   있다). 새로 만든 QR도 꺼진 QR도 같은 자리에 다시 그려진다 - 어디로도 가지
//   않는다는 것이 명세의 뜻이다.
//
// 비활성화가 붉은 것은 design의 사실이다(25:418 #E7000B). button.emphasis는
// primary·secondary·quiet 셋뿐이라 '되돌릴 수 없다'를 명세가 말하지 못하므로,
// 그 뜻은 design/tones.ts의 DANGER_BUTTON 한 곳이 든다(D02·D04와 같은 자리).

const SCREEN = 'EVT-04B'

const NODE = {
  head: '25:369',
  close: '25:371',
  code: '25:376',
  state: '25:392',
  window: '25:394',
  guide: '25:403',
  download: '25:405',
  regenerate: '25:411',
  deactivate: '25:418',
} as const

const ASSET = {
  close: '25:371',
  code: '25:378',
  download: '25:406',
  regenerate: '25:412',
} as const

interface EVT04BScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT04BScreen({ screenParams, onNavigate }: EVT04BScreenProps) {
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()

  const head = elementByNodeId(evt04b, NODE.head).spec as SummarySpec
  const close = elementByNodeId(evt04b, NODE.close).spec as ButtonSpec
  const code = elementByNodeId(evt04b, NODE.code).spec as SummarySpec
  const state = elementByNodeId(evt04b, NODE.state).spec as SummarySpec
  const checkInWindow = elementByNodeId(evt04b, NODE.window).spec as SummarySpec
  const guide = elementByNodeId(evt04b, NODE.guide).spec as SummarySpec
  const download = elementByNodeId(evt04b, NODE.download).spec as ButtonSpec
  const regenerate = elementByNodeId(evt04b, NODE.regenerate).spec as ButtonSpec
  const deactivate = elementByNodeId(evt04b, NODE.deactivate).spec as ButtonSpec

  const goBack = () => {
    if (close.action.type === 'navigate') {
      onNavigate(close.action.targetScreenId, resolveParams(close.action.params, { screenParams }))
    }
  }

  // 어느 행사의 QR인지 모르면 보여줄 QR이 없다. 첫 행사를 대신 집어 오지 않는다 -
  // 남의 행사 QR을 내주는 것이 조용한 대체 중 가장 나쁜 종류다.
  const missing = (evt04b.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <ModalShell screenParams={screenParams} onClose={goBack}>
        <p role="alert" className="px-6 py-6 text-sm text-red-700">
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </ModalShell>
    )
  }

  // 아직 QR을 만들지 않은 행사가 있다. 그때 무엇이라 말할지는 화면이 짓지 않는다 -
  // 카탈로그의 messages.empty가 이미 갖고 있다.
  const qr = readObjectSourceOrNull(
    state.dataSourceKey ?? '',
    resolveParams(state.params, { screenParams }),
  )
  if (qr === null) {
    return (
      <ModalShell screenParams={screenParams} onClose={goBack}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 data-node-id={NODE.head} className="text-base font-semibold text-gray-900">
            {head.title}
          </h2>
          <button
            type="button"
            data-node-id={NODE.close}
            aria-label={close.label}
            onClick={goBack}
            className="shrink-0 rounded p-1 hover:bg-gray-50"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-3.5" />
          </button>
        </div>
        <p data-design-state="empty" className="px-6 py-8 text-center text-xs text-gray-400">
          {findDataSource(state.dataSourceKey).messages.empty}
        </p>
      </ModalShell>
    )
  }

  const text = (row: DataRow, field: string | undefined) =>
    field === undefined ? '' : String(row[field] ?? '')

  const submit = (spec: ButtonSpec) => () => {
    setNote(null)
    void submitAction.run(spec.action as SubmitAction, { payload: {}, onNavigate })
  }

  return (
    <ModalShell screenParams={screenParams} onClose={goBack}>
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 data-node-id={NODE.head} className="text-base font-semibold text-gray-900">
          {head.title}
        </h2>
        <button
          type="button"
          data-node-id={NODE.close}
          aria-label={close.label}
          onClick={goBack}
          className="shrink-0 rounded p-1 hover:bg-gray-50"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 px-6 py-6">
        {/* design이 QR 자리에 그린 것은 회색 네모와 'QR 코드'라는 글이다(25:376).
            실제 그림은 서버가 만들고, 명세가 아는 것은 받아 갈 파일 이름까지다. */}
        <div
          data-node-id={NODE.code}
          className="flex size-40 flex-col items-center justify-center gap-2 rounded border border-gray-200 bg-gray-100"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.code} className="size-12" />
          <span className="text-xs text-gray-400">{code.title}</span>
        </div>

        {/* 딱지의 글도 색 이름도 데이터가 준다. 여기 목록을 적으면 QR 상태가 하나
            늘 때마다 이 화면이 조용히 틀린다. */}
        <span
          data-node-id={NODE.state}
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            STATE_CHIP[text(qr, state.toneField)] ?? STATE_CHIP.gray
          }`}
        >
          {text(qr, (state.items ?? [])[0]?.field)}
        </span>

        <dl data-node-id={NODE.window} className="flex w-full flex-col gap-2">
          {(checkInWindow.items ?? []).map((item) => (
            <div key={item.field} className="flex items-center gap-3">
              <dt className="w-12 shrink-0 text-xs text-gray-500">{item.label}</dt>
              <dd className="min-w-0 flex-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-800">
                {text(qr, item.field)}
              </dd>
            </div>
          ))}
        </dl>

        <p data-node-id={NODE.guide} className="text-center text-xs text-gray-400">
          {text(qr, (guide.items ?? [])[0]?.field)}
        </p>

        <div className="flex w-full gap-2">
          <button
            type="button"
            data-node-id={NODE.download}
            onClick={() => {
              if (download.action.type !== 'download') return
              setNote(`${download.label}: ${text(qr, download.action.downloadField)}`)
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.download} className="size-3" />
            {download.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.regenerate}
            onClick={submit(regenerate)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.regenerate} className="size-3" />
            {submitAction.labelOf(regenerate.action as SubmitAction, regenerate.label)}
          </button>
          <button
            type="button"
            data-node-id={NODE.deactivate}
            onClick={submit(deactivate)}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none ${DANGER_BUTTON}`}
          >
            {submitAction.labelOf(deactivate.action as SubmitAction, deactivate.label)}
          </button>
        </div>

        {note === null ? null : (
          <p role="status" className="text-xs text-gray-500">
            {note}
          </p>
        )}
        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="text-xs text-red-500">
            {submitAction.errorMessage}
          </p>
        )}
      </div>
    </ModalShell>
  )
}

interface ModalShellProps {
  screenParams: Record<string, string>
  onClose: () => void
  children: ReactNode
}

// 뒤에 남아 있는 화면과 그 위의 카드. 명세가 overlay로 말한 두 가지다 -
// 어느 화면이 남는가(screenId)와 이 화면이 그리는 부분이 어디인가(source).
function ModalShell({ screenParams, onClose, children }: ModalShellProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <EVT04Screen screenParams={screenParams} onNavigate={() => undefined} />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={evt04b.meta?.title ?? evt04b.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-[440px] rounded-lg border border-gray-200 bg-white shadow-2xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
