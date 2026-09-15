import { lazyScreen } from './lazy-screen'
import { stateScopeKeyOf } from '../../spec/screen-runtime.generated'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

const HOME01KScreen = lazyScreen(() => import('../HOME01KScreen').then((module) => module.HOME01KScreen))
const MY01Screen = lazyScreen(() => import('../MY01Screen').then((module) => module.MY01Screen))
const MYINFO01Screen = lazyScreen(() => import('../MYINFO01Screen').then((module) => module.MYINFO01Screen))

export const homeScreens = [
  {
    screenIds: ['HOME-01K'],
    render: ({ onNavigate }) => {
      // 읽기 전용 대시보드다. 상태 스코프를 참조하지 않는다.
      return <HOME01KScreen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['MY-01'],
    render: ({ onNavigate }) => {
      // 대시보드와 같은 읽기 화면이다. 탭·검색어는 목록을 거르는 화면 안의 값이라
      // 상태 스코프(화면 간 유지)에 담지 않는다.
      return <MY01Screen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['MY-INFO-01'],
    render: ({ scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      return (
        <MYINFO01Screen
          draft={readScopeDraft(scopes, stateScopeKeyOf('MY-INFO-01'))}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('MY-INFO-01') ?? '', next)}
          onNavigate={onNavigate}
          onScopeEvent={onScopeEvent}
        />
      )
    },
  },
] satisfies readonly ScreenRegistration[]
