import { ORG00Screen } from '../ORG00Screen'
import { ORG01Screen } from '../ORG01Screen'
import { ORG03AScreen } from '../ORG03AScreen'
import { ORG03BScreen } from '../ORG03BScreen'
import { ORG03DScreen } from '../ORG03DScreen'
import { ORG03CScreen } from '../ORG03CScreen'
import { ORG04Screen } from '../ORG04Screen'
import { ORG04BScreen } from '../ORG04BScreen'
import { ORG07AScreen } from '../ORG07AScreen'
import { ORG07BScreen } from '../ORG07BScreen'
import { ORG07CScreen } from '../ORG07CScreen'
import { ORG02Screen } from '../ORG02Screen'
import { org04b, onb01, org01, org02, org03b, org03d } from '../../spec/screens'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

export const organizationScreens = [
  {
    screenIds: ['ORG-00'],
    render: ({ onNavigate }) => {
      // 읽기 전용 허브다. 상태 스코프를 참조하지 않는다.
      return <ORG00Screen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['ORG-03D'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 구성원 내보내기 확인 모달이다. 뒤에 ORG-03B가 그대로 남고 **그 초안까지
      // 그대로 남는다** — 같은 스코프를 쓰므로 확인을 열었다 돌아와도 사람이
      // 옮겨 놓은 자리가 사라지지 않는다.
      return (
        <ORG03DScreen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, org03d.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(org03d.stateScopeKey ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['ORG-03A'],
    render: ({ onNavigate }) => {
      // 저장된 조직도를 읽는 화면이다. 상태 스코프를 참조하지 않는다.
      return <ORG03AScreen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['ORG-03B'],
    render: ({ scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      return (
        <ORG03BScreen
          draft={readScopeDraft(scopes, org03b.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(org03b.stateScopeKey ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['ORG-03C'],
    render: ({ onNavigate }) => {
      // 조직도 곁에 붙는 칸이다. 초대 값은 서버가 만들고 화면은 담지 않는다.
      return <ORG03CScreen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['ORG-04'],
    render: ({ onNavigate }) => {
      // 읽기만 하는 화면이다. 역할을 바꾸는 것은 ORG-04B다.
      return <ORG04Screen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['ORG-04B'],
    render: ({ scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 바꿀 역할은 화면 안이 아니라 roleChangeDraft에 담긴다(org.changeRole의
      // payloadScope). 누구의 역할인지는 자리가 실어 가므로 초안에 담기지 않는다.
      return (
        <ORG04BScreen
          draft={readScopeDraft(scopes, org04b.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(org04b.stateScopeKey ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['ORG-07A'],
    render: ({ onNavigate }) => {
      return <ORG07AScreen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['ORG-07B'],
    render: ({ onNavigate }) => {
      // 모달이다. 뒤에 ORG-07A가 그대로 남는다(명세: overlay).
      return <ORG07BScreen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['ORG-07C'],
    render: ({ onNavigate }) => {
      return <ORG07CScreen onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['ORG-01'],
    render: ({ scopes, onChangeScope, onNavigate }) => {
      return (
        <ORG01Screen
          draft={readScopeDraft(scopes, org01.stateScopeKey)}
          scopes={scopes}
          onChangeDraft={(next) => onChangeScope(org01.stateScopeKey ?? '', next)}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['ORG-02'],
    render: ({ scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      return (
        <ORG02Screen
          // 만드는 사람도 학생회의 일원이라 앞 화면이 담은 학적이 함께 가야 한다.
          joining={readScopeDraft(scopes, onb01.stateScopeKey)}
          draft={readScopeDraft(scopes, org02.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(org02.stateScopeKey ?? '', next)}
          onNavigate={onNavigate}
          onScopeEvent={onScopeEvent}
        />
      )
    },
  },
] satisfies readonly ScreenRegistration[]
