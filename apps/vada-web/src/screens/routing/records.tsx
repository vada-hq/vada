import { REC01Screen } from '../REC01Screen'
import { REC02Screen } from '../REC02Screen'
import { REC02AScreen } from '../REC02AScreen'
import { rec02, rec02a } from '../../spec/screens'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

export const recordsScreens = [
  {
    screenIds: ['REC-01'],
    render: ({ onNavigate }) => {
      // 셸의 '기록' 메뉴가 가리키는 화면 자신이다 — 그래서 activeNavigationScreenId가 없다.
      // 검색어는 목록을 거르는 화면 안의 값이라 스코프에 담지 않는다.
      return <REC01Screen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['REC-02'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate }) => {
      // 발행된 아카이브를 읽는다. 인수인계 체크만 값을 담으므로 그 스코프를 넘긴다 —
      // **저장 단추가 그림에 없어** 어디로도 보내지 않는다(meetingMinutesDraft와 같은 처지).
      return (
        <REC02Screen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, rec02.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(rec02.stateScopeKey ?? '', next)}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['REC-02A'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate }) => {
      // 아카이브를 쓰고 검토받는다. 쓰는 칸은 전부 archiveDraft에 산다.
      return (
        <REC02AScreen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, rec02a.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(rec02a.stateScopeKey ?? '', next)}
          onNavigate={onNavigate}
        />
      )
    },
  },
] satisfies readonly ScreenRegistration[]
