import type { ReactNode } from 'react'
import { CONFIRM_NOTE, DANGER_BUTTON } from '../design/tones'
import { Field } from '../components/Field'
import { FigmaAsset } from '../components/FigmaAsset'
import { resolveParams } from '../spec/params'
import { elementByNodeId, opsMeetD04 } from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, InputSpec, SubmitAction, SummarySpec } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'
import { OPSMEET03AScreen } from './OPSMEET03AScreen'

// 회의 취소 확인(OPS-MEET-D04). D01과 같은 틀 위에 선 둘째 확인 모달이다.
//
// 뒤에 남는 것은 D01과 같은 **03A**다. 그림이 그린 배경은 03B(생성자)이지만 03B는
// 화면이 아니라 03A의 변형이고, 취소는 생성자만 하는 일이다(meeting-model.md).
//
// **다섯 확인 중 유일하게 서버를 읽지 않는다.** 본문 글 셋이 전부 고정 카피라
// dataSourceKey가 없다 — 취소가 무엇을 뜻하는지는 어느 회의냐에 따라 달라지지
// 않기 때문이다. 대신 D01에 없던 것이 하나 있다: **보낼 값**이다.
//
// 취소 사유는 필수이고 여러 줄이다. 필수를 화면이 다시 세지 않는다 —
// executeWhen이 명세에 있고 판정은 한 곳에서만 돈다(useFieldDraft.runButton).
// 사유는 화면 안의 useState가 아니라 meetingCancelDraft에 담긴다. 그것이
// payloadScope가 가리키는 자리이고, 담기지 않으면 보낼 것이 비어서 간다.
//
// 취소를 보낸 뒤 어디로 가는지는 **그림에 이음이 없다.** 09(취소된 회의)가
// 유력하나 09가 그린 회의는 아예 다른 회의라 이음이라 부를 수 없다. 명세가
// onSuccess를 비워 두었으므로 여기서도 데려가지 않는다.

const SCREEN = 'OPS-MEET-D04'

const NODE = {
  head: '20:4033',
  notice: '20:4044',
  reason: '20:4048',
  back: '20:4054',
  cancel: '20:4056',
} as const

const ASSET = {
  head: '20:4034',
} as const

interface OPSMEETD04ScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function OPSMEETD04Screen({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
}: OPSMEETD04ScreenProps) {
  const head = elementByNodeId(opsMeetD04, NODE.head).spec as SummarySpec
  const notice = elementByNodeId(opsMeetD04, NODE.notice).spec as SummarySpec
  const reason = elementByNodeId(opsMeetD04, NODE.reason).spec as InputSpec
  const back = elementByNodeId(opsMeetD04, NODE.back).spec as ButtonSpec
  const cancel = elementByNodeId(opsMeetD04, NODE.cancel).spec as ButtonSpec

  const field = useFieldDraft({ elements: opsMeetD04.elements, draft, onChangeDraft })
  const submitAction = useSubmitAction()

  // 어느 회의를 취소할지 모르면 취소할 것이 없다. 인자가 비면 첫 회의를 대신
  // 집어 오지 않는다 — 취소는 되돌릴 수 없어서 잘못 짚으면 되돌릴 길이 없다.
  const missingParam = (opsMeetD04.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )

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

  const reasonError = field.errors[reason.fieldKey]

  return (
    <ConfirmShell screenParams={screenParams} onClose={goBack}>
      <div data-node-id={NODE.head} className="px-6 pt-6 pb-5">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.head} className="size-9" />
        <h2 className="pt-4 text-base font-bold text-gray-900">{head.title}</h2>
        <p className="pt-2 text-sm text-gray-600">{head.description}</p>

        {/* 왜 사유가 필요한지를 이 줄이 말한다. 별표만 있으면 '왜'가 사라진다. */}
        <p
          data-node-id={NODE.notice}
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${CONFIRM_NOTE.red}`}
        >
          {notice.title}
        </p>

        <div className="pt-4">
          <Field
            htmlFor={reason.fieldKey}
            nodeId={NODE.reason}
            label={reason.label}
            required={reason.required}
            error={reasonError}
          >
            {/* design이 Text Area로 그린 자리다(input.multiline). 한 줄짜리를 그리면
                '긴 글'이라는 사실이 화면에서 사라진다. */}
            <textarea
              id={reason.fieldKey}
              ref={field.registerRef(reason.fieldKey)}
              rows={4}
              value={draft.values[reason.fieldKey] ?? reason.initialValue ?? ''}
              placeholder={reason.placeholder ?? undefined}
              aria-invalid={reasonError === undefined ? undefined : true}
              onChange={(event) =>
                field.setFieldValue(reason.fieldKey, event.target.value === '' ? null : event.target.value)
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
            />
          </Field>
        </div>
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
          data-node-id={NODE.cancel}
          onClick={() =>
            // 막는 조건은 명세에 있다(executeWhen). 빈 칸을 짚고 그리로 데려가는
            // 것까지 한 곳에서 돈다 — 화면마다 옮겨 적으면 언젠가 갈린다.
            field.runButton(cancel, () => {
              void submitAction.run(cancel.action as SubmitAction, {
                payload: draft.values,
                onNavigate,
              })
            })
          }
          className={`rounded px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none ${DANGER_BUTTON}`}
        >
          {submitAction.labelOf(cancel.action as SubmitAction, cancel.label)}
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
        <OPSMEET03AScreen screenParams={screenParams} onNavigate={() => undefined} />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={opsMeetD04.meta?.title ?? opsMeetD04.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
