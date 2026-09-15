import { lazyScreen } from './lazy-screen'
import { stateScopeKeyOf } from '../../spec/screen-runtime.generated'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

const INV00Screen = lazyScreen(() => import('../INV00Screen').then((module) => module.INV00Screen))
const INV01Screen = lazyScreen(() => import('../INV01Screen').then((module) => module.INV01Screen))
const ONB01Screen = lazyScreen(() => import('../ONB01Screen').then((module) => module.ONB01Screen))
const SIGNINScreen = lazyScreen(() => import('../SIGNINScreen').then((module) => module.SIGNINScreen))
const ONB02Screen = lazyScreen(() => import('../ONB02Screen').then((module) => module.ONB02Screen))

export const accessScreens = [
  {
    screenIds: ['ONB-01'],
    render: ({ scopes, onChangeScope, onNavigate }) => {
      return (
        <ONB01Screen
          draft={readScopeDraft(scopes, stateScopeKeyOf('ONB-01'))}
          scopes={scopes}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('ONB-01') ?? '', next)}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['INV-01'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      return (
        <INV01Screen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, stateScopeKeyOf('INV-01'))}
          scopes={scopes}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('INV-01') ?? '', next)}
          onNavigate={onNavigate}
          onScopeEvent={onScopeEvent}
        />
      )
    },
  },
  {
    screenIds: ['INV-00'],
    render: ({ scopes, onChangeScope, onNavigate }) => {
      // 초대 코드는 화면 안이 아니라 onboardingDraft에 담긴다 — INV-01이 같은
      // 스코프를 쓰므로 넘어가서도 남는다.
      return (
        <INV00Screen
          draft={readScopeDraft(scopes, stateScopeKeyOf('INV-00'))}
          scopes={scopes}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('INV-00') ?? '', next)}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['SIGN-IN'],
    render: () => {
      return <SIGNINScreen />
    },
  },
  {
    screenIds: ['ONB-02'],
    render: ({ onNavigate }) => {
      return <ONB02Screen onNavigate={onNavigate} />
    },
  },
] satisfies readonly ScreenRegistration[]
