import type { ReactNode } from 'react'
import { CONFIRM_NOTE } from '../design/tones'
import { FigmaAsset } from '../components/FigmaAsset'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, opsMeetD01 } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, SubmitAction, SummarySpec } from '../spec/types'
import { OPSMEET03AScreen } from './OPSMEET03AScreen'

// 회의 시작 확인(OPS-MEET-D01). 회의 계열의 첫 확인 모달이다.
//
// 뒤에 남는 것은 **03A**다. 그림이 그린 배경은 03B(생성자가 볼 때)이지만 03B는
// 화면이 아니라 03A의 변형이고, overlay.screenId는 주소를 가진 화면 하나만
// 받는다(docs/decisions/meeting-model.md). 03C에서 눌러도 뒤에 남는 것은 같은
// 상세다 — 무엇 위에 뜨는가를 변형마다 답하지 않아도 되는 것이 그 결정의 값이다.
//
// **살펴 준 것은 한 줄뿐이다.** 며칠 이른지는 예정 시각과 지금을 견줘야 아는
// 것이라 화면이 셀 수 없고(meeting.startConfirm.warningNote), 예정 시각에
// 시작하면 아예 오지 않는다. 오지 않으면 그 칸은 그려지지 않는다 — 없으면 오지
// 않는다는 것이 optional의 뜻이다.
//
// 시작을 보낸 뒤 어디로 가는지는 **그림에 이음이 없다.** 05A가 유력하나 명세가
// onSuccess를 비워 두었으므로 여기서도 데려가지 않는다 — 지어내면 그것이 계약이 된다.

const SCREEN = 'OPS-MEET-D01'

const NODE = {
  head: '20:3109',
  warning: '20:3119',
  back: '20:3123',
  start: '20:3125',
} as const

const ASSET = {
  head: '20:3110',
} as const

interface OPSMEETD01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function OPSMEETD01Screen({ screenParams, onNavigate }: OPSMEETD01ScreenProps) {
  const head = elementByNodeId(opsMeetD01, NODE.head).spec as SummarySpec
  const warning = elementByNodeId(opsMeetD01, NODE.warning).spec as SummarySpec
  const back = elementByNodeId(opsMeetD01, NODE.back).spec as ButtonSpec
  const start = elementByNodeId(opsMeetD01, NODE.start).spec as ButtonSpec

  const submitAction = useSubmitAction()

  // 어느 회의를 시작할지 모르면 확인할 것이 없다. 인자가 비면 첫 회의를 대신
  // 집어 오지 않는다 — 그러면 사람이 남의 회의를 자기 것으로 시작한다(03A와 같은 규칙).
  const missingParam = (opsMeetD01.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )

  // 닫으면 어디로 가는지는 명세가 말한다. 지어내면 명세를 고쳐도 화면이 안 따라온다.
  const goBack = () => {
    if (back.action.type === 'navigate') {
      onNavigate(back.action.targetScreenId, resolveParams(back.action.params, { screenParams }))
    }
  }

  if (missingParam !== undefined) {
    return (
      <ConfirmShell screenParams={screenParams} onClose={goBack}>
        <p role="alert" className="px-6 py-6 text-sm text-red-700">
          {missingParam.missingNote}
        </p>
      </ConfirmShell>
    )
  }

  const confirm = readObjectSourceOrNull(
    warning.dataSourceKey,
    resolveParams(warning.params, { screenParams }),
  )
  const warningNote = confirm === null ? undefined : confirm[warning.titleField ?? '']

  return (
    <ConfirmShell screenParams={screenParams} onClose={goBack}>
      <div data-node-id={NODE.head} className="px-6 pt-6 pb-5">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.head} className="size-9" />
        <h2 className="pt-4 text-base font-bold text-gray-900">{head.title}</h2>
        <p className="pt-2 text-sm text-gray-600">{head.description}</p>

        {confirm === null ? (
          <p role="status" className="mt-4 text-sm text-gray-600">
            {findDataSource(warning.dataSourceKey).messages.empty}
          </p>
        ) : warningNote === undefined ? null : (
          <p
            data-node-id={NODE.warning}
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${CONFIRM_NOTE.gray}`}
          >
            {String(warningNote)}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button
          type="button"
          data-node-id={NODE.back}
          onClick={goBack}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {back.label}
        </button>
        <button
          type="button"
          data-node-id={NODE.start}
          onClick={() => {
            // 보낼 초안이 없다 — 무엇을 시작하는지는 화면이 받은 인자가 안다.
            void submitAction.run(start.action as SubmitAction, {
              payload: { meetingId: screenParams.meetingId ?? '' },
              onNavigate,
            })
          }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {submitAction.labelOf(start.action as SubmitAction, start.label)}
        </button>
      </div>

      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="px-6 pb-4 text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}
      {/* 보내고 나면 어디로 가는지가 아직 정해지지 않았다고 명세가 적어
          두었으면 그 글을 내놓는다. 적어만 두고 안 보여주면 보내고 나서
          아무 일도 안 일어나는 것처럼 보인다. */}
      {submitAction.pendingNote === null ? null : (
        <p role="status" className="px-6 pb-4 text-xs text-gray-500">
          {submitAction.pendingNote}
        </p>
      )}
    </ConfirmShell>
  )
}

interface ConfirmShellProps {
  screenParams: Record<string, string>
  onClose: () => void
  children: ReactNode
}

// 뒤에 남아 있는 화면과 그 위의 카드. 명세가 overlay로 말한 두 가지다 —
// 어느 화면이 남는가(screenId)와 이 화면이 그리는 부분이 어디인가(source).
function ConfirmShell({ screenParams, onClose, children }: ConfirmShellProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <OPSMEET03AScreen screenParams={screenParams} onNavigate={() => undefined} />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={opsMeetD01.meta?.title ?? opsMeetD01.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
