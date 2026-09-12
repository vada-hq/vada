import { EXT01AScreen } from '../EXT01AScreen'
import { EXT01BScreen } from '../EXT01BScreen'
import { EXT02AScreen } from '../EXT02AScreen'
import { EXT02BScreen } from '../EXT02BScreen'
import { EXT02CScreen } from '../EXT02CScreen'
import { ext01a, ext02a } from '../../spec/screens'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

export const publicScreens = [
  {
    screenIds: ['EXT-01A'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // QR로 온 참석자가 보는 화면이다. 셸이 없고(viewer: external), 주소가 실어 오는
      // 것은 eventId가 아니라 QR의 토큰이다 — QR은 껐다 켜고 다시 만들 수 있으므로
      // 가리키는 것이 행사가 아니다.
      return (
        <EXT01AScreen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, ext01a.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(ext01a.stateScopeKey ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['EXT-01B'],
    render: ({ screenParams, onNavigate }) => {
      // 참석 확인의 결과. **한 사람에게 하나만 온다** — 그림이 여섯을 나란히 그린
      // 것은 값의 나열이고, 명세가 source.alsoDrawnAt으로 그 사실을 든다.
      return <EXT01BScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EXT-02A'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 링크로 온 설문 응답자가 보는 참여 신청 폼이다. 셸이 없고 주소가 실어 오는
      // 것은 설문의 토큰이다 — 설문은 교체될 수 있다.
      return (
        <EXT02AScreen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, ext02a.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(ext02a.stateScopeKey ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['EXT-02B'],
    render: ({ screenParams }) => {
      // 신청을 마치고 보는 화면. **나가는 단추가 아예 없어** onNavigate도 받지
      // 않는다 — 이 저장소의 첫 막다른 화면이다.
      return <EXT02BScreen screenParams={screenParams} />
    },
  },
  {
    screenIds: ['EXT-02C'],
    render: ({ screenParams, onNavigate }) => {
      // 막힌 설문 링크의 안내. 다섯 상태 중 하나만 그려지고, 그중 하나(교체됨)만
      // 갈 곳이 있다 — 새 설문의 신청 폼.
      return <EXT02CScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
] satisfies readonly ScreenRegistration[]
