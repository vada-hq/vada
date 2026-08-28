import type { ReactNode } from 'react'
import { FigmaAsset } from '../components/FigmaAsset'
import { Field } from '../components/Field'
import { elementByNodeId, evt00b } from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, InputSpec, SubmitAction, SummarySpec } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'
import { EVT00AScreen } from './EVT00AScreen'

// 새 행사 만들기(EVT-00B). 행사 갈래의 첫 모달이다.
//
// **뒤에 남는 것은 EVT-00A다.** 그림이 그린 배경은 EVT-00A2(새 행사를 만들 수 있는
// 사람이 보는 그림)이지만 그것은 화면이 아니라 변형이고, overlay.screenId는 주소를
// 가진 화면 하나만 받는다. OPS-MEET-D02가 05B를 그려 놓고 05A라 적은 것과 같은
// 자리다(docs/decisions/meeting-model.md).
//
// **받는 것이 행사명 하나뿐이다.** 일시·장소·참가비·운영 조직은 여기서 묻지 않고
// 행사 공간에서 나중에 채운다 — 그 사실을 명세가 helperText와 안내 상자로 들고
// 있으므로 화면이 다시 적지 않는다.
//
// 행사명은 화면 안의 useState가 아니라 **eventCreateDraft에 담긴다.** 그것이
// event.create의 payloadScope가 가리키는 자리이고, 담기지 않으면 보낼 것이 비어서
// 간다. 필수 판정도 화면이 다시 세지 않는다(executeWhen · useFieldDraft.runButton).
//
// 만들고 나서 어디로 가는지는 **그림에 이음이 없다.** 새 행사의 행사 개요(EVT-02)가
// 유력하지만 방금 만든 행사의 id를 무엇이 주는지도 그려져 있지 않다. 명세가
// onSuccess를 비워 두었으므로 여기서도 데려가지 않는다.

const SCREEN = 'EVT-00B'

const NODE = {
  head: '20:4649',
  close: '20:4651',
  title: '20:4656',
  note: '20:4663',
  cancel: '20:4667',
  create: '20:4669',
} as const

const ASSET = {
  close: '20:4651',
} as const

interface EVT00BScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT00BScreen({
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: EVT00BScreenProps) {
  const head = elementByNodeId(evt00b, NODE.head).spec as SummarySpec
  const close = elementByNodeId(evt00b, NODE.close).spec as ButtonSpec
  const title = elementByNodeId(evt00b, NODE.title).spec as InputSpec
  const note = elementByNodeId(evt00b, NODE.note).spec as SummarySpec
  const cancel = elementByNodeId(evt00b, NODE.cancel).spec as ButtonSpec
  const create = elementByNodeId(evt00b, NODE.create).spec as ButtonSpec

  const field = useFieldDraft({ elements: evt00b.elements, draft, onChangeDraft })
  const submitAction = useSubmitAction()

  // 닫으면 어디로 가는지는 명세가 말한다. 지어내면 명세를 고쳐도 화면이 안 따라온다.
  const goBack = (button: ButtonSpec) => {
    if (button.action.type !== 'navigate') return
    // 떠나면서 초안을 어떻게 끝내는지는 **명세가 말한다.** 여기서 정하면
    // 명세를 고쳐도 화면이 안 따라온다.
    if (button.action.scopeEvent !== undefined) {
      onScopeEvent(evt00b.stateScopeKey ?? '', button.action.scopeEvent)
    }
    onNavigate(button.action.targetScreenId)
  }

  const titleError = field.errors[title.fieldKey]

  return (
    <CreateShell onClose={() => goBack(close)}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <h2 data-node-id={NODE.head} className="text-sm font-semibold text-gray-900">
          {head.title}
        </h2>
        <button
          type="button"
          data-node-id={NODE.close}
          aria-label={close.label}
          onClick={() => goBack(close)}
          className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-4" />
        </button>
      </div>

      <div className="px-6 pt-5 pb-1">
        <Field
          htmlFor={title.fieldKey}
          nodeId={NODE.title}
          label={title.label}
          required={title.required}
          error={titleError}
          helperText={title.helperText}
        >
          <input
            id={title.fieldKey}
            ref={field.registerRef(title.fieldKey)}
            type={title.inputType}
            value={draft.values[title.fieldKey] ?? title.initialValue ?? ''}
            placeholder={title.placeholder ?? undefined}
            aria-invalid={titleError === undefined ? undefined : true}
            onChange={(event) =>
              field.setFieldValue(
                title.fieldKey,
                event.target.value === '' ? null : event.target.value,
              )
            }
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
        </Field>

        {/* 모달 안에서 '나중에 채울 수 있다'를 일러 주는 파란 상자. 배합은
            ORG-07C 30:6168과 같다(-100 테두리 · -50 바탕 · -700 글). 같은 것을
            세 번째 옮겨 적게 되면 그때가 design/tones.ts로 올릴 자리다. */}
        <p
          data-node-id={NODE.note}
          className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-blue-700"
        >
          {note.title}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 pt-6 pb-6">
        <button
          type="button"
          data-node-id={NODE.cancel}
          onClick={() => goBack(cancel)}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {cancel.label}
        </button>
        <button
          type="button"
          data-node-id={NODE.create}
          onClick={() =>
            // 막는 조건은 명세에 있다(executeWhen). 빈 칸을 짚고 그리로 데려가는
            // 것까지 한 곳에서 돈다 — 화면마다 옮겨 적으면 언젠가 갈린다.
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
      </div>

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
    </CreateShell>
  )
}

interface CreateShellProps {
  onClose: () => void
  children: ReactNode
}

// 뒤에 남아 있는 화면과 그 위의 카드. 명세가 overlay로 말한 두 가지다 —
// 어느 화면이 남는가(screenId)와 이 화면이 그리는 부분이 어디인가(source).
function CreateShell({ onClose, children }: CreateShellProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <EVT00AScreen onNavigate={() => undefined} />
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={evt00b.meta?.title ?? evt00b.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
