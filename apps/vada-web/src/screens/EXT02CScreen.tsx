import { useState } from 'react'
import { FigmaAsset } from '../components/FigmaAsset'
import { MobileScreen } from '../components/MobileScreen'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import {
  LINK_STATE_ACTION,
  LINK_STATE_CARD,
  LINK_STATE_TITLE,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
} from '../design/tones'
import { resolveParams } from '../spec/params'
import { elementByNodeId, ext02c } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import type { SummarySpec } from '../spec/types'

// 설문 예외·종료 상태(EXT-02C).
//
// **링크로 온 설문 응답자가 본다. 로그인한 사람이 없다**(명세의 viewer: external).
// 링크가 살아 있으면 서버가 신청 폼(EXT-02A)으로 보내므로, 이 화면이 열렸다는 것
// 자체가 '지금은 받지 않는다'는 뜻이다(docs/decisions/product-decisions.md).
//
// **카드는 한 장이다.** 와이어프레임이 다섯을 나란히 그린 것은 화면 다섯이 아니라
// 한 자리의 값 다섯이다 — 서로 배타적이라 한 사람에게 하나만 온다. 명세가 그
// 사실을 source.alsoDrawnAt으로 들고, 화면은 데이터가 준 것 하나만 그린다.
//
// **상태 이름을 화면이 알지 않는다.** '모집 전'도 '정원 마감'도, 그 카드의 색도
// 서버가 준다(survey.linkState의 label·tone·note). 무엇이 링크를 막는지는 모집
// 일정·정원·운영진의 조작이 정하므로, 화면이 목록을 들면 하나 늘 때 조용히 틀린다.
//
// **'돌아가기'를 그리지 않는다.** 그림은 다섯 카드에 모두 그렸지만 외부인에게 열린
// 다른 화면이 없다 — 갈 곳이 없으면 단추도 없다(사람이 정한 것). 그 자리는
// design/deviations.ts에 적혀 있다. 다섯째 카드의 '새 설문으로 이동 →'만 다르다:
// 갈 곳이 확실하고(새 설문의 신청 폼) 그 토큰은 서버만 안다.
//
// **명세가 담지 못한 것이 하나 있다.** 이 자리의 그림이 상태마다 다른데, 그 사실을
// 적을 자리가 없다(제안: summary.iconField). 여기서는 다섯이 같은 동그라미 느낌표
// 이고 색만 갈리므로 명세가 이미 가리킨 톤으로 고를 수 있다 — 모양까지 갈리는
// 자리(EXT-01B)는 그렇게 할 수 없다.

const SCREEN = 'EXT-02C'

const NODE = {
  state: '30:7279',
} as const

// 어느 자리에 어떤 그림이 오는지는 design이 갖는다(components/FigmaAsset). 다만
// **어느 것이 오는지는 데이터가 정한다** — 그 이음이 명세에 없어 여기 있다.
// 회색 둘(모집 전·모집 마감)은 같은 그림이라 한 자리다.
const ASSET_BY_TONE: Record<string, string> = {
  gray: '30:7280',
  orange: '30:7306',
  red: '30:7319',
  yellow: '30:7332',
}

interface EXT02CScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

export function EXT02CScreen({ screenParams, onNavigate }: EXT02CScreenProps) {
  const [notice, setNotice] = useState<string | null>(null)
  const state = elementByNodeId(ext02c, NODE.state).spec as SummarySpec

  // 토큰이 없으면 아무 설문의 상태나 대신 보여주지 않는다.
  const missingParam = (ext02c.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const link =
    missingParam === undefined
      ? readObjectSourceOrNull(
          state.dataSourceKey ?? '',
          resolveParams(state.params, { screenParams }),
        )
      : null

  if (missingParam !== undefined || link === null) {
    return (
      <MobileScreen>
        <p role="alert" className="pt-8 text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(state.dataSourceKey ?? '').messages.empty}
        </p>
      </MobileScreen>
    )
  }

  const tone = scalar(link, state.toneField)
  const action = state.action
  // 갈 곳이 없는 상태에는 단추의 글이 오지 않는다. 명세가 labelField로 그 규칙을
  // 든다 — 화면이 '어느 상태에 단추가 있는지'를 알면 상태가 늘 때 틀린다.
  const actionLabel =
    action?.labelField === undefined ? '' : scalar(link, action.labelField)

  function press() {
    if (action === undefined) {
      return
    }
    if (action.type === 'pending') {
      setNotice(action.note)
      return
    }
    // 어느 설문으로 가는지는 이 링크가 안다. 새 토큰은 주소에도 화면에도 없고
    // 서버가 이은 것이다(sourceField — OPS-MEET-09의 replacementMeetingId와 같다).
    onNavigate(
      targetScreenOf(action, link ?? {}) ?? action.type,
      resolveParams(action.params, { screenParams, row: link ?? undefined }),
    )
  }

  return (
    // 머리가 없다. 맨 위의 '설문 예외·종료 상태'는 갤러리 캡션이다 — 프레임 이름의
    // 꼬리이고, 응답자에게 할 말이 아니다. 이 화면의 제목은 상태의 이름이다
    // (명세의 meta.titleFrom).
    <MobileScreen>
      {/* 상태 카드 30:7279. 나머지 넷은 같은 자리를 다른 값으로 그린 사본이다. */}
      <section
        data-node-id={NODE.state}
        className={`mt-8 flex flex-col items-center gap-3 rounded-xl p-5 text-center ${
          LINK_STATE_CARD[tone] ?? NEUTRAL_CHIP
        }`}
      >
        <FigmaAsset
          screenId={SCREEN}
          nodeId={ASSET_BY_TONE[tone] ?? ASSET_BY_TONE.gray}
          className="size-8"
        />
        {/* 값마다 제 요소를 갖는다 — 한 덩이로 두면 대조가 그 글을 못 짚는다. */}
        <div>
          <h1 className={`text-sm font-semibold ${LINK_STATE_TITLE[tone] ?? NEUTRAL_VALUE}`}>
            {scalar(link, state.titleField)}
          </h1>
          <p className="text-xs text-gray-500">{scalar(link, state.descriptionField)}</p>
        </div>
        {actionLabel === '' ? null : (
          <button
            type="button"
            onClick={press}
            className={`rounded-md px-5 py-2 text-xs font-semibold ${
              LINK_STATE_ACTION[tone] ?? NEUTRAL_CHIP
            }`}
          >
            {actionLabel}
          </button>
        )}
      </section>

      {notice === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {notice}
        </p>
      )}
    </MobileScreen>
  )
}
