import { lazyScreen } from './lazy-screen'
import { msg02 } from '../../spec/screens'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

const MSG01Screen = lazyScreen(() => import('../MSG01Screen').then((module) => module.MSG01Screen))
const MSG02Screen = lazyScreen(() => import('../MSG02Screen').then((module) => module.MSG02Screen))
const MSG03Screen = lazyScreen(() => import('../MSG03Screen').then((module) => module.MSG03Screen))

export const messagesScreens = [
  {
    screenIds: ['MSG-01'],
    render: ({ onNavigate }) => {
      // 셸의 '메시지' 메뉴가 가리키는 화면 자신이다 — 그래서 activeNavigationScreenId가 없다.
      return <MSG01Screen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['MSG-02'],
    render: ({ scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 새 메시지 방 만들기 모달이다. 뒤에 MSG-01이 그대로 남는다(명세의 overlay).
      return (
        <MSG02Screen
          draft={readScopeDraft(scopes, msg02.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(msg02.stateScopeKey ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['MSG-03'],
    render: ({ screenParams, onNavigate }) => {
      // 대화. 메뉴가 가리키는 화면이 아니라 그 아래다(activeNavigationScreenId: MSG-01).
      return <MSG03Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
] satisfies readonly ScreenRegistration[]
