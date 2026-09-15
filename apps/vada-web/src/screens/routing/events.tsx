import { lazyScreen } from './lazy-screen'
import { stateScopeKeyOf } from '../../spec/screen-runtime.generated'
import { readScopeDraft, scopeDraftKey } from '../../state/scopes'
import type { ScreenRegistration } from './types'

const EVT00AScreen = lazyScreen(() => import('../EVT00AScreen').then((module) => module.EVT00AScreen))
const EVT02Screen = lazyScreen(() => import('../EVT02Screen').then((module) => module.EVT02Screen))
const EVT00BScreen = lazyScreen(() => import('../EVT00BScreen').then((module) => module.EVT00BScreen))
const EVT01Screen = lazyScreen(() => import('../EVT01Screen').then((module) => module.EVT01Screen))
const EVT02BScreen = lazyScreen(() => import('../EVT02BScreen').then((module) => module.EVT02BScreen))
const EVT02CScreen = lazyScreen(() => import('../EVT02CScreen').then((module) => module.EVT02CScreen))
const EVT02DScreen = lazyScreen(() => import('../EVT02DScreen').then((module) => module.EVT02DScreen))
const EVT02EScreen = lazyScreen(() => import('../EVT02EScreen').then((module) => module.EVT02EScreen))
const EVT03AScreen = lazyScreen(() => import('../EVT03AScreen').then((module) => module.EVT03AScreen))
const EVT03BScreen = lazyScreen(() => import('../EVT03BScreen').then((module) => module.EVT03BScreen))
const EVT04BScreen = lazyScreen(() => import('../EVT04BScreen').then((module) => module.EVT04BScreen))
const EVTDOC01Screen = lazyScreen(() => import('../EVTDOC01Screen').then((module) => module.EVTDOC01Screen))
const EVTMEET01Screen = lazyScreen(() => import('../EVTMEET01Screen').then((module) => module.EVTMEET01Screen))
const EVTSCHED01Screen = lazyScreen(() => import('../EVTSCHED01Screen').then((module) => module.EVTSCHED01Screen))
const EVT04Screen = lazyScreen(() => import('../EVT04Screen').then((module) => module.EVT04Screen))
const EVT05Screen = lazyScreen(() => import('../EVT05Screen').then((module) => module.EVT05Screen))
const EVT05BScreen = lazyScreen(() => import('../EVT05BScreen').then((module) => module.EVT05BScreen))
const EVTFIN01Screen = lazyScreen(() => import('../EVTFIN01Screen').then((module) => module.EVTFIN01Screen))
const EVTTASK01Screen = lazyScreen(() => import('../EVTTASK01Screen').then((module) => module.EVTTASK01Screen))
const EVTTASK02Screen = lazyScreen(() => import('../EVTTASK02Screen').then((module) => module.EVTTASK02Screen))

export const eventsScreens = [
  {
    screenIds: ['EVT-02'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 개요다. 행사 작업 공간의 첫 갈피이고, 어느 행사인지는 주소가 실어 온다.
      return <EVT02Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-00B'],
    render: ({ scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 새 행사 만들기 모달이다. 뒤에 EVT-00A가 그대로 남는다(명세의 overlay) —
      // 그림이 그린 배경은 EVT-00A2이지만 그것은 변형이라 주소가 없다.
      // 행사명은 화면 안이 아니라 eventCreateDraft에 담긴다(event.create의 payloadScope).
      return (
        <EVT00BScreen
          draft={readScopeDraft(scopes, stateScopeKeyOf('EVT-00B'))}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('EVT-00B') ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['EVT-01'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 행사 운영 조직을 처음 세운다. 셸이 없는 카드 한 장이고 겹쳐 뜨는 화면이
      // 아니다 — 이 와이어프레임의 모달은 뒤에 남는 화면을 형제로 함께 그린다.
      return (
        <EVT01Screen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, stateScopeKeyOf('EVT-01'))}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('EVT-01') ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['EVT-02B'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 행사 기본정보 편집 패널이다. 뒤에 EVT-02가 그대로 남는다(명세: overlay).
      // 초안은 화면 안이 아니라 eventBasicsDraft에 살며 행사별로 분리한다.
      const draftKey = scopeDraftKey(stateScopeKeyOf('EVT-02B'), {
        eventId: screenParams.eventId,
      })
      return (
        <EVT02BScreen
          key={screenParams.eventId}
          screenParams={screenParams}
          draft={readScopeDraft(scopes, draftKey)}
          onChangeDraft={(next) => onChangeScope(draftKey, next)}
          onScopeEvent={(_scopeKey, event) => onScopeEvent(draftKey, event)}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['EVT-02C'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 종료 권한 없음 모달이다. 뒤에 행사 개요(EVT-02)가 그대로 남는다.
      // 보낼 것도 고를 것도 없다 — 누가 할 수 있는지를 서버에게 묻고 알릴 뿐이다.
      return <EVT02CScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-02E'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 완료 처리 확인 모달이다. 뒤에 후속 정리 중 개요(EVT-02D)가 남는다.
      // 살펴 준 한 줄은 막지 않는다(meeting.endConfirm과 같은 자리).
      return <EVT02EScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-02D'],
    render: ({ screenParams, onNavigate }) => {
      // 후속 정리 중인 행사의 개요다. EVT-02와 같은 '개요' 갈피에서 열리지만 겹치는
      // 것이 둘뿐이고 그 둘조차 다르다 - 상태가 화면을 가른다.
      return <EVT02DScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-03A'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 운영 조직이다. '인원 관리' 갈피 아래로 한 겹 더 들어간 화면이고,
      // 어느 행사인지는 주소가 실어 온다.
      return <EVT03AScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-03B'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 운영 조직을 고친다. EVT-03A가 읽는 나무를 여기서 고치고, 완료를 눌러야
      // 실제로 바뀐다(stateScopeKey: eventStaffEditDraft).
      return (
        <EVT03BScreen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, stateScopeKeyOf('EVT-03B'))}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('EVT-03B') ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['EVT-04B'],
    render: ({ screenParams, onNavigate }) => {
      // 참석 확인 QR 모달이다. 뒤에 EVT-04가 그대로 남는다(명세: overlay).
      // QR은 행사 상태와 따로 켜고 끄므로 뒤 화면의 상태를 읽지 않는다.
      return <EVT04BScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-DOC-01'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 문서다. 작업 공간의 세 번째 갈피이고, 어느 행사인지는 주소가 실어 온다.
      return <EVTDOC01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-MEET-01'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 관련 회의다. 작업 공간의 네 번째 갈피이고, 어느 행사인지는 주소가 실어 온다.
      return <EVTMEET01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-SCHED-01'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 일정이다. 작업 공간의 다섯 번째 갈피이고, 어느 행사인지는 주소가 실어 온다.
      return <EVTSCHED01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-04'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 참가자 명단이다. 작업 공간의 여섯 번째 갈피이고, 어느 행사인지는 주소가 실어 온다.
      return <EVT04Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-05'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate }) => {
      // 참여 설문 생성·관리다. 인원 관리 갈피 아래로 한 겹 더 들어간 화면이고,
      // 모집 설정 초안은 화면 안이 아니라 eventSurveyDraft에 산다.
      return (
        <EVT05Screen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, stateScopeKeyOf('EVT-05'))}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('EVT-05') ?? '', next)}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['EVT-05B'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 설문 교체다. 카드 한 장이지만 겹쳐 뜨는 화면이 아니다 — 뒤에 아무것도 남지
      // 않고 제 셸을 그린다(EVT-01과 같다).
      return (
        <EVT05BScreen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, stateScopeKeyOf('EVT-05B'))}
          onChangeDraft={(next) => onChangeScope(stateScopeKeyOf('EVT-05B') ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['EVT-FIN-01'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 재정이다. 작업 공간의 일곱 번째이자 마지막 갈피다.
      return <EVTFIN01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-TASK-01'],
    render: ({ screenParams, onNavigate }) => {
      // 행사 업무 보드다. 어느 행사인지는 화면 안에 없고 주소가 실어 온다.
      return <EVTTASK01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-TASK-02'],
    render: ({ screenParams, onNavigate }) => {
      // 상세 화면이다. 무엇의 상세인지는 화면 안에 없고 주소가 실어 온다.
      return <EVTTASK02Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['EVT-00A', 'EVT-00A2'],
    render: ({ screenId, onNavigate }) => {
      // 행사 목록이다. 거르는 값(검색어·진행 단계)은 화면 안에서만 쓴다.
      //
      // EVT-00A2는 다른 화면이 아니라 **새 행사를 만들 수 있는 사람이 본 같은 화면**
      // 이다(event.listViewer의 canCreateEvent). FIN-00B와 같은 자리다.
      return <EVT00AScreen screenId={screenId} onNavigate={onNavigate} />
    },
  },
] satisfies readonly ScreenRegistration[]
