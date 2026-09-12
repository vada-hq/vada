import type { ReactNode } from 'react'
import { CONFIRM_NOTE } from '../design/tones'
import { FigmaAsset } from '../components/FigmaAsset'
import { readObjectSourceOrNull } from '../data-sources/catalog'
import { findDataSource } from '../data-sources/definitions'
import { resolveParams } from '../spec/params'
import { elementByNodeId, org03d } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, SubmitAction, SummarySpec } from '../spec/types'
import { ORG03BScreen } from './ORG03BScreen'
import type { ScopeDraft } from '../state/scopes'

// 구성원 내보내기 확인(ORG-03D).
//
// **되돌릴 수 없는 일이 저장에 섞여 있었다.** 조직 관리 — 수정의 '구성원 삭제'는
// 오랫동안 조직도 초안에서 줄을 빼는 것이었고, 그 초안을 '완료'로 저장하면 서버가
// 받을 수 없어 422가 났다. 자리를 옮기다 손이 미끄러진 것과 사람을 내보내는 것이
// 같은 저장으로 나가고 있었다는 뜻이다. 되돌릴 수 없는 일은 그 일만 하는 자리로
// 온다 — 여기가 그 자리다.
//
// **묻는 말이 서버에서 온다.** '김바다 님을 내보낼까요?'의 이름을 화면이 문장에
// 끼워 넣으면 화면마다 다른 말이 나온다. D03과 같은 길이고, 고정 카피뿐인
// D04와는 반대편이다.
//
// **뒤에 남는 것은 ORG-03B이고 그 초안은 살아 있다.** 같은 stateScopeKey를 쓰므로
// 확인을 열었다 돌아와도 사람이 옮겨 놓은 자리가 그대로다.

const NODE = {
  head: '617:473',
  note: '617:484',
  back: '617:494',
  remove: '617:496',
} as const

const ASSET = {
  head: '617:474',
} as const

interface ORG03DScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function ORG03DScreen({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: ORG03DScreenProps) {
  const head = elementByNodeId(org03d, NODE.head).spec as SummarySpec
  const note = elementByNodeId(org03d, NODE.note).spec as SummarySpec
  const back = elementByNodeId(org03d, NODE.back).spec as ButtonSpec
  const remove = elementByNodeId(org03d, NODE.remove).spec as ButtonSpec

  const submitAction = useSubmitAction()

  // 누구를 내보내는지 모르면 묻지 않는다. **아무나 집어 오지 않는다** — 되돌릴 수
  // 없는 일이라 잘못 고른 것은 눌린 뒤에야 드러난다.
  const missingParam = (org03d.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )

  const goBack = () => {
    if (back.action.type === 'navigate') {
      onNavigate(back.action.targetScreenId, resolveParams(back.action.params, { screenParams }))
    }
  }

  const shell = (children: ReactNode) => (
    <ConfirmShell
      draft={draft}
      onChangeDraft={onChangeDraft}
      onScopeEvent={onScopeEvent}
      onClose={goBack}
    >
      {children}
    </ConfirmShell>
  )

  if (missingParam !== undefined) {
    return shell(
      <p role="alert" className="px-6 py-6 text-sm text-red-700">
        {missingParam.missingNote}
      </p>,
    )
  }

  const target = readObjectSourceOrNull(
    head.dataSourceKey,
    resolveParams(head.params, { screenParams }),
  )

  return shell(
    <>
      <div data-node-id={NODE.head} className="px-6 pt-6 pb-5">
        <FigmaAsset screenId={org03d.screenId} nodeId={ASSET.head} className="size-9" />

        {target === null ? (
          // 누구인지 못 찾으면 이름을 지어내지 않는다. 먼저 내보낸 사람이 있으면
          // 여기에 온다 — 그때 무엇이라 말할지는 카탈로그가 갖고 있다.
          <p role="status" className="pt-4 text-sm text-gray-600">
            {findDataSource(head.dataSourceKey).messages.empty}
          </p>
        ) : (
          <>
            {/* 이름이 박힌 완성된 문장이다. 화면이 '{이름} 님을'을 잇지 않는다. */}
            <h2 className="pt-4 text-base font-bold text-gray-900">
              {String(target[head.titleField ?? ''] ?? '')}
            </h2>
            <p className="pt-2 text-sm text-gray-600">{head.description}</p>

            <p
              data-node-id={NODE.note}
              // 되돌릴 수 없는 일이라 붉다(design 617:484). 무채색으로 두면 이것이
              // 권한의 범위 설명처럼 보인다 — D03의 회색 상자가 그 자리다.
              className={`mt-4 rounded-md border px-4 py-3 text-sm ${CONFIRM_NOTE.red}`}
            >
              {note.title}
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
          data-node-id={NODE.remove}
          disabled={target === null}
          onClick={() => {
            void submitAction.run(remove.action as SubmitAction, {
              // 보낼 초안이 없다 — 누구를 내보내는지는 자리가 안다. 그 자리를
              // 명세가 `screenParam`으로 가리키므로 값이 어디 있는지만 알려 준다.
              payload: {},
              paramSources: { screenParams },
              onNavigate,
            })
          }}
          // 되돌릴 수 없는 일이라 붉다. 파랗게 두면 '완료'와 같은 무게로 보인다.
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {submitAction.labelOf(remove.action as SubmitAction, remove.label)}
        </button>
      </div>

      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="px-6 pb-4 text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}
      {submitAction.pendingNote === null ? null : (
        <p role="status" className="px-6 pb-4 text-xs text-gray-500">
          {submitAction.pendingNote}
        </p>
      )}
    </>,
  )
}

interface ConfirmShellProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onClose: () => void
  children: ReactNode
}

// 뒤에 남아 있는 화면과 그 위의 카드. 명세가 overlay로 말한 두 가지다.
//
// **초안을 그대로 넘긴다.** 뒤의 화면은 사람이 고치고 있던 조직도를 들고 있고,
// 빈 초안을 주면 확인을 여는 순간 옮겨 놓은 자리가 전부 사라진 것처럼 보인다.
function ConfirmShell({ draft, onChangeDraft, onScopeEvent, onClose, children }: ConfirmShellProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <ORG03BScreen
          draft={draft}
          onChangeDraft={onChangeDraft}
          onScopeEvent={onScopeEvent}
          onNavigate={() => undefined}
        />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={org03d.meta?.title ?? org03d.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
