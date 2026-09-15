import { msg02 } from '../../spec/screen-specs/msg02'
import type { SubmitAction } from '../../spec/types'
import type { MessageRoomDraftModel } from './useMessageRoomDraft'
import { NODE } from './spec'

export function MessageRoomActions({ model }: { model: MessageRoomDraftModel }) {
  const {
    cancel,
    create,
    goBack,
    field,
    submitAction,
    draft,
    onNavigate,
    onScopeEvent,
    note,
  } = model
  return (
    <>
      {/* 30:7026 — 바닥 줄은 gray-50 바탕에 gray-100 선이다. */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 bg-gray-50 px-6 py-4">
        <p className="text-xs text-gray-500">{msg02.meta?.footerNote}</p>
        <span className="flex items-center gap-3">
          <button
            type="button"
            data-node-id={NODE.cancel}
            onClick={() => goBack(cancel)}
            className="rounded px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {cancel.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.create}
            onClick={() =>
              // 막는 조건은 명세에 있다(executeWhen). 빈 칸을 짚고 그리로 데려가는
              // 것까지 한 곳에서 돈다.
              field.runButton(create, () => {
                void submitAction.run(create.action as SubmitAction, {
                  payload: draft.values,
                  onNavigate,
                  onScopeEvent,
                })
              })
            }
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {submitAction.labelOf(create.action as SubmitAction, create.label)}
          </button>
        </span>
      </div>

      {note === null ? null : (
        <p role="status" className="px-6 pb-4 text-xs text-gray-500">
          {note}
        </p>
      )}
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="px-6 pb-4 text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}
      {/* 보내고 나면 어디로 가는지가 아직 정해지지 않았다고 명세가 적어 두었으면
          그 글을 내놓는다. 적어만 두고 안 보여주면 보내고 나서 아무 일도 안
          일어나는 것처럼 보인다. */}
      {submitAction.pendingNote === null ? null : (
        <p role="status" className="px-6 pb-4 text-xs text-gray-500">
          {submitAction.pendingNote}
        </p>
      )}
    </>
  )
}
