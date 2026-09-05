import type { ReactNode } from 'react'
import { Built } from '../components/Built'
import { FigmaAsset } from '../components/FigmaAsset'
import { NEUTRAL_BORDER, SOFT_BOX } from '../design/tones'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, evt02e } from '../spec/screens'
import type { ButtonSpec, SummarySpec } from '../spec/types'
import { EVT02DScreen } from './EVT02DScreen'

// 행사 완료 처리 확인(EVT-02E). 회의의 OPS-MEET-D02와 같은 자리다 —
// **살펴 준 한 줄은 막지 않는다.** 미완료 업무가 남아 있어도 알려 줄 뿐이고,
// 그래서 이 화면에는 executeWhen이 없다. 무엇을 '남은 것'으로 세는지가 행사
// 운영의 규칙이라 서버가 완성한 한 줄로 오고, 없으면 아예 오지 않는다(optional).
//
// **뒤에 남는 것은 EVT-02D다.** 그림은 EVT-02(기획 중 개요)의 프레임을 배경으로
// 복사해 두었지만 그 배경의 브리핑 줄만 '현재 상태: 후속 정리 중'으로 바뀌어
// 있고, 살펴 준 값('미완료 업무 6건')도 권한 안내도 EVT-02D가 그린 것과 같은
// 글이다. 완료 처리는 후속 정리 중인 행사에서만 있는 동작이고, 단추의 글도
// '계속 정리하기'다.
//
// **완료 처리 단추가 그림에 없다.** 되돌아가는 단추 오른쪽 자리를 '행사 완료
// 처리는 회장단만 할 수 있습니다.'가 채우고 있다 — 지금 보는 사람이 회장단이
// 아니기 때문이다. 그래서 event.complete를 부르는 자리가 이 화면에 없다.
// 지어내면 그것이 계약이 된다.

const SCREEN = 'EVT-02E'

const NODE = {
  head: '20:6336',
  warning: '20:6339',
  note: '20:6347',
  back: '20:6350',
  permission: '20:6352',
} as const

const ASSET = {
  warning: '20:6341',
} as const

interface EVT02EScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT02EScreen({ screenParams, onNavigate }: EVT02EScreenProps) {
  const head = elementByNodeId(evt02e, NODE.head).spec as SummarySpec
  const warning = elementByNodeId(evt02e, NODE.warning).spec as SummarySpec
  const note = elementByNodeId(evt02e, NODE.note).spec as SummarySpec
  const back = elementByNodeId(evt02e, NODE.back).spec as ButtonSpec
  const permission = elementByNodeId(evt02e, NODE.permission).spec as SummarySpec

  // 어느 행사를 완료 처리할지 모르면 살펴볼 것도 없다. 인자가 비면 첫 행사를
  // 대신 집어 오지 않는다 — 완료 처리는 되돌릴 수 없어서 잘못 짚으면 길이 없다.
  const missingParam = (evt02e.params ?? []).find(
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
  const warningTone = confirm === null ? '' : String(confirm[warning.toneField ?? ''] ?? '')

  return (
    <ConfirmShell screenParams={screenParams} onClose={goBack}>
      <div className="px-6 pt-6 pb-1">
        <h2 data-node-id={NODE.head} className="text-sm font-semibold text-gray-900">
          {head.title}
        </h2>

        {confirm === null ? (
          <p role="status" className="pt-4 text-sm text-gray-600">
            {findDataSource(warning.dataSourceKey).messages.empty}
          </p>
        ) : warningNote === undefined ? null : (
          // 상자의 색 이름도 데이터가 준다(warningTone). 무엇이 얼마나 급한지는
          // 행사마다 다르고, 명세가 색을 들면 한 화면이 두 색을 그릴 때 틀린다.
          <div
            data-node-id={NODE.warning}
            className={`mt-4 flex items-center gap-2 rounded-md border px-4 py-3 ${
              SOFT_BOX[warningTone] ?? NEUTRAL_BORDER
            }`}
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.warning} className="size-3.5" />
            <span className="text-xs text-gray-700">{String(warningNote)}</span>
          </div>
        )}

        {/* 막지 않는다는 사실을 말하는 줄이다. 완료해도 기록은 남는다. */}
        <p data-node-id={NODE.note} className="pt-4 text-xs text-gray-500">
          {note.title}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 pt-5 pb-6">
        <button
          type="button"
          data-node-id={NODE.back}
          onClick={goBack}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {back.label}
        </button>
        {/* 으뜸 단추가 올 자리를 이 글이 대신 채운다. 누가 완료 처리할 수
            있는지는 조직의 규칙이라 서버가 완성해 온다(permissionNote). */}
        <PermissionNote screenParams={screenParams} spec={permission} />
      </div>
    </ConfirmShell>
  )
}

function PermissionNote({
  screenParams,
  spec,
}: {
  screenParams: Record<string, string>
  spec: SummarySpec
}) {
  const row = readObjectSourceOrNull(spec.dataSourceKey, resolveParams(spec.params, { screenParams }))
  if (row === null) return null
  return (
    <span data-node-id={NODE.permission} className="text-xs text-gray-400">
      {String(row[spec.titleField ?? ''])}
    </span>
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
      {/* **뒤에 남는 화면만 따로 가린다.** 후속 정리 개요가 읽는 넷이 아직 안
          지어졌는데, 그 하나 때문에 이 모달까지 통째로 준비 중이 되면 지어 놓은
          자리를 아무도 못 본다(components/Built.tsx가 그 까닭을 적어 두었다). */}
      <div aria-hidden className="pointer-events-none">
        <Built what="후속 정리 개요">
          <EVT02DScreen screenParams={screenParams} onNavigate={() => undefined} />
        </Built>
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={evt02e.meta?.title ?? evt02e.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
