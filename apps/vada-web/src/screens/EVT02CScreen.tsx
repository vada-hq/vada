import type { ReactNode } from 'react'
import { Built } from '../components/Built'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, evt02c } from '../spec/screens'
import type { ButtonSpec, SummarySpec } from '../spec/types'
import { EVT02Screen } from './EVT02Screen'

// 행사 종료 권한 없음(EVT-02C). 확인 모달 넷과 틀은 같은데 **확인시키는 것이 없다** —
// 되돌아가는 문 하나뿐이고 보낼 것도 고를 것도 없다.
//
// **역할 이름을 이 화면이 들지 않는다.** '행사 운영 조직 관리자 또는 회장단'은
// 서버가 완성해 준다(event.endPermission의 title·note). 여기 적으면 조직 규칙이
// 바뀔 때마다 이 화면이 조용히 틀린다 — EVT-02D가 상태 이름과 권한 안내를 서버에
// 맡긴 것과 같은 자리다.
//
// 그래서 제목도 데이터다(명세의 meta.titleFrom). meta.title '행사 종료 확인'은
// 사람이 이 화면을 부르는 말로만 남는다(OPS-MEET-D03과 같은 모양).
//
// **행사 종료 단추를 그린 프레임이 없다.** 이 모달이 무엇 위에서 열리는지는
// 그림이 배경으로만 답한다 — 뒤에 남는 것은 행사 개요(EVT-02)이고, 단추의 글도
// '행사 개요로'다.

const NODE = {
  title: '20:5687',
  note: '20:5689',
  back: '20:5692',
} as const

interface EVT02CScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT02CScreen({ screenParams, onNavigate }: EVT02CScreenProps) {
  const title = elementByNodeId(evt02c, NODE.title).spec as SummarySpec
  const note = elementByNodeId(evt02c, NODE.note).spec as SummarySpec
  const back = elementByNodeId(evt02c, NODE.back).spec as ButtonSpec

  // 어느 행사를 종료하려 했는지 모르면 누가 할 수 있는지도 물을 수 없다. 인자가
  // 비면 첫 행사를 대신 집어 오지 않는다 — 그러면 남의 행사의 권한을 읽는다.
  const missingParam = (evt02c.params ?? []).find(
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
      <PermissionShell screenParams={screenParams} onClose={goBack}>
        <p role="alert" className="px-6 py-6 text-sm text-red-700">
          {missingParam.missingNote}
        </p>
      </PermissionShell>
    )
  }

  const permission = readObjectSourceOrNull(
    title.dataSourceKey,
    resolveParams(title.params, { screenParams }),
  )

  return (
    <PermissionShell screenParams={screenParams} onClose={goBack}>
      <div className="px-6 pt-6 pb-1">
        {permission === null ? (
          <p role="status" className="text-sm text-gray-600">
            {findDataSource(title.dataSourceKey).messages.empty}
          </p>
        ) : (
          <>
            <h2 data-node-id={NODE.title} className="text-sm font-semibold text-gray-900">
              {String(permission[title.titleField ?? ''])}
            </h2>
            {/* 누가 할 수 있는지. 이 글이 곧 조직의 규칙이라 서버가 완성해 온다. */}
            <p data-node-id={NODE.note} className="pt-2 text-xs text-gray-500">
              {String(permission[note.titleField ?? ''])}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-end px-6 pt-5 pb-6">
        <button
          type="button"
          data-node-id={NODE.back}
          onClick={goBack}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {back.label}
        </button>
      </div>
    </PermissionShell>
  )
}

interface PermissionShellProps {
  screenParams: Record<string, string>
  onClose: () => void
  children: ReactNode
}

// 뒤에 남아 있는 화면과 그 위의 카드. 명세가 overlay로 말한 두 가지다 —
// 어느 화면이 남는가(screenId)와 이 화면이 그리는 부분이 어디인가(source).
function PermissionShell({ screenParams, onClose, children }: PermissionShellProps) {
  return (
    <>
      {/* **뒤에 남는 화면만 따로 가린다.** 행사 개요가 읽는 여섯이 아직 안 지어졌는데,
          그 하나 때문에 이 모달까지 통째로 준비 중이 되면 지어 놓은 자리를 아무도
          못 본다 — 홈이 그랬다(components/Built.tsx가 그 까닭을 적어 두었다). */}
      <div aria-hidden className="pointer-events-none">
        <Built what="행사 개요">
          <EVT02Screen screenParams={screenParams} onNavigate={() => undefined} />
        </Built>
      </div>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={evt02c.meta?.title ?? evt02c.screenId}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
