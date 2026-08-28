import type { ReactNode } from 'react'
import { CONFIRM_NOTE, DANGER_BUTTON } from '../design/tones'
import { FigmaAsset } from '../components/FigmaAsset'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, opsMeetD02 } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, SubmitAction, SummarySpec } from '../spec/types'
import { OPSMEET05AScreen } from './OPSMEET05AScreen'

// 회의 종료 확인(OPS-MEET-D02). D01과 노드 대 노드로 같은 틀이다.
//
// **뒤에 남는 것은 05A다.** 그림이 그린 배경은 05B(진행 권한자)이지만 05B는
// 화면이 아니라 05A의 변형이고, overlay.screenId는 주소를 가진 화면 하나만
// 받는다(docs/decisions/meeting-model.md). D01이 03B 배경인데 03A라 적은 것과
// 같은 자리다.
//
// **종료는 완료가 아니다.** 이 화면의 설명이 회의 상태 축을 못 박는 자리다 —
// 종료하면 '완료'가 아니라 '정리 중'이 되고, 회의록과 결정을 확인한 뒤에 따로
// 정리 완료한다(meeting.end의 계약도 같은 말을 한다).
//
// **살펴 준 한 줄은 막지 않는다.** 미완료 안건이 남아 있어도 종료 단추는 살아
// 있다(meeting.endConfirm). 알려 줄 뿐이고, 그래서 이 화면에는 executeWhen이
// 없다. 셋을 세어 잇는 일은 화면이 못 한다 — 무엇을 '미완료'로 세는지가 회의
// 진행의 규칙이라 서버가 완성한 한 줄로 온다. 없으면 오지 않는다(optional).
//
// 종료를 보낸 뒤 어디로 가는지는 **그림에 이음이 없다.** 06A(정리 중)가
// 유력하나 명세가 onSuccess를 비워 두었으므로 여기서도 데려가지 않는다 —
// 지어내면 그것이 계약이 된다.

const SCREEN = 'OPS-MEET-D02'

const NODE = {
  head: '20:3445',
  warning: '20:3456',
  back: '20:3460',
  end: '20:3462',
} as const

const ASSET = {
  head: '20:3446',
} as const

interface OPSMEETD02ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function OPSMEETD02Screen({ screenParams, onNavigate }: OPSMEETD02ScreenProps) {
  const head = elementByNodeId(opsMeetD02, NODE.head).spec as SummarySpec
  const warning = elementByNodeId(opsMeetD02, NODE.warning).spec as SummarySpec
  const back = elementByNodeId(opsMeetD02, NODE.back).spec as ButtonSpec
  const end = elementByNodeId(opsMeetD02, NODE.end).spec as ButtonSpec

  const submitAction = useSubmitAction()

  // 어느 회의를 종료할지 모르면 종료할 것이 없다. 인자가 비면 첫 회의를 대신
  // 집어 오지 않는다 — 그러면 사람이 남의 회의를 자기 것으로 끝낸다(D01과 같은 규칙).
  const missingParam = (opsMeetD02.params ?? []).find(
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
          // D01의 같은 자리는 무채색인데 여기는 붉다. 되돌릴 수 없는 동작을
          // 앞두고 미완료를 알리는 줄이기 때문이다(design 20:3456).
          <p
            data-node-id={NODE.warning}
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${CONFIRM_NOTE.red}`}
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
          data-node-id={NODE.end}
          onClick={() => {
            // 보낼 초안이 없다 — 무엇을 끝내는지는 화면이 받은 인자가 안다.
            void submitAction.run(end.action as SubmitAction, {
              payload: { meetingId: screenParams.meetingId ?? '' },
              onNavigate,
            })
          }}
          // 되돌릴 수 없는 동작이라 붉다(design 20:3462). D04의 '회의 취소'와 같은 자리다.
          className={`rounded px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none ${DANGER_BUTTON}`}
        >
          {submitAction.labelOf(end.action as SubmitAction, end.label)}
        </button>
      </div>

      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="px-6 pb-4 text-xs text-red-500">
          {submitAction.errorMessage}
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
        <OPSMEET05AScreen screenParams={screenParams} onNavigate={() => undefined} />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={opsMeetD02.meta?.title ?? opsMeetD02.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
