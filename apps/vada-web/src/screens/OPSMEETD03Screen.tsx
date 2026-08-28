import type { ReactNode } from 'react'
import { CONFIRM_NOTE } from '../design/tones'
import { FigmaAsset } from '../components/FigmaAsset'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, opsMeetD03 } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, SubmitAction, SummarySpec } from '../spec/types'
import { OPSMEET04BScreen } from './OPSMEET04BScreen'

// 진행 권한 부여 확인(OPS-MEET-D03). 회의 계열 확인 모달의 마지막이다.
//
// **뒤에 남는 것은 04B이고, 04B는 변형이 아니라 화면이다.** D01·D02·D04의
// 배경이 전부 '변형이라 주소가 없는 그림'이었던 것과 반대 자리다 — 04B가
// 모달이었다면 모달 위 모달이 된다(docs/decisions/meeting-model.md).
//
// **본문 글 셋이 전부 서버에서 온다.** 제목에 사람 이름이 박혀 있고('이수현에게
// …'), 그 사람이 갖게 되는 것과 갖지 못하는 것은 '진행 권한'이라는 역할이
// 무엇이냐의 문제다. 명세가 '{이름}에게 …'를 조립하면 그 문장이 명세의 것이
// 되고, 역할의 내용이 명세에 고정된다 — 조직 규칙이 바뀌면 명세가 틀린다.
// 그래서 D04(고정 카피 셋, 읽는 것 없음)와 정확히 반대편에 선다.
//
// **인자가 둘이다.** 진행 권한은 이 회의에만 적용되므로 사람만으로는 무엇을
// 주는지 정해지지 않는다(04B가 스스로 못 박는다). meetingId·memberId 둘이 다
// 있어야 물어볼 문장이 완성된다.
//
// 부여를 보낸 뒤 어디로 가는지는 **그림에 이음이 없다.** 04B로 돌아가는 것이
// 유력하나 명세가 onSuccess를 비워 두었으므로 여기서도 데려가지 않는다.

const SCREEN = 'OPS-MEET-D03'

const NODE = {
  head: '20:3685',
  limit: '20:3697',
  back: '20:3701',
  grant: '20:3703',
} as const

const ASSET = {
  head: '20:3686',
} as const

interface OPSMEETD03ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function OPSMEETD03Screen({ screenParams, onNavigate }: OPSMEETD03ScreenProps) {
  const head = elementByNodeId(opsMeetD03, NODE.head).spec as SummarySpec
  const limit = elementByNodeId(opsMeetD03, NODE.limit).spec as SummarySpec
  const back = elementByNodeId(opsMeetD03, NODE.back).spec as ButtonSpec
  const grant = elementByNodeId(opsMeetD03, NODE.grant).spec as ButtonSpec

  const submitAction = useSubmitAction()

  // 어느 회의의 권한인지, 누구에게 주는지 — 둘 중 하나만 없어도 물어볼 것이 없다.
  // 비면 아무나 집어 오지 않는다: 권한을 잘못 준 것은 눌린 뒤에야 드러난다.
  const missingParam = (opsMeetD03.params ?? []).find(
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

  // 셋이 한 출처의 조각이라 한 번 읽는다. 제목만 오고 안내는 안 오는 일은 없다 —
  // 나뉘어 있는 것은 그려지는 자리이지 사실이 아니다.
  const confirm = readObjectSourceOrNull(
    head.dataSourceKey,
    resolveParams(head.params, { screenParams }),
  )

  return (
    <ConfirmShell screenParams={screenParams} onClose={goBack}>
      <div data-node-id={NODE.head} className="px-6 pt-6 pb-5">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.head} className="size-9" />

        {confirm === null ? (
          // 누구의 권한인지 못 찾으면 이름을 지어내지 않는다. 무엇이라 말할지는
          // 화면이 아니라 카탈로그가 갖고 있다.
          <p role="status" className="pt-4 text-sm text-gray-600">
            {findDataSource(head.dataSourceKey).messages.empty}
          </p>
        ) : (
          <>
            {/* 이름이 박힌 완성된 문장이다. 화면이 '{이름}에게'를 잇지 않는다. */}
            <h2 className="pt-4 text-base font-bold text-gray-900">
              {String(confirm[head.titleField ?? ''] ?? '')}
            </h2>
            <p className="pt-2 text-sm text-gray-600">
              {String(confirm[head.descriptionField ?? ''] ?? '')}
            </p>

            {/* 갖게 되는 것 아래에 갖지 못하는 것. 무채색인 것은 이것이 경고가
                아니라 권한의 범위이기 때문이다(design 20:3697). */}
            <p
              data-node-id={NODE.limit}
              className={`mt-4 rounded-md border px-4 py-3 text-sm ${CONFIRM_NOTE.gray}`}
            >
              {String(confirm[limit.titleField ?? ''] ?? '')}
            </p>
          </>
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
          data-node-id={NODE.grant}
          onClick={() => {
            // 보낼 초안이 없다 — 누구에게 무엇을 주는지는 화면이 받은 인자 둘이 안다.
            void submitAction.run(grant.action as SubmitAction, {
              payload: {
                meetingId: screenParams.meetingId ?? '',
                memberId: screenParams.memberId ?? '',
              },
              onNavigate,
            })
          }}
          // 권한을 더하는 일이라 파랗다(design 20:3703). 뺏는 쪽이었다면 붉었을
          // 것인데, '권한 해제'에는 확인 모달이 아예 그려지지 않았다.
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {submitAction.labelOf(grant.action as SubmitAction, grant.label)}
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
        <OPSMEET04BScreen screenParams={screenParams} onNavigate={() => undefined} />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={opsMeetD03.meta?.title ?? opsMeetD03.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
