import { EVT00AScreen } from '../EVT00AScreen'
import { EVT02Screen } from '../EVT02Screen'
import { EVT00BScreen } from '../EVT00BScreen'
import { EVT01Screen } from '../EVT01Screen'
import { EVT02BScreen } from '../EVT02BScreen'
import { EVT02CScreen } from '../EVT02CScreen'
import { EVT02DScreen } from '../EVT02DScreen'
import { EVT02EScreen } from '../EVT02EScreen'
import { EVT03AScreen } from '../EVT03AScreen'
import { EVT03BScreen } from '../EVT03BScreen'
import { EVT04BScreen } from '../EVT04BScreen'
import { EVTDOC01Screen } from '../EVTDOC01Screen'
import { EVTMEET01Screen } from '../EVTMEET01Screen'
import { EVTSCHED01Screen } from '../EVTSCHED01Screen'
import { EVT04Screen } from '../EVT04Screen'
import { EVT05Screen } from '../EVT05Screen'
import { EVT05BScreen } from '../EVT05BScreen'
import { EVTFIN01Screen } from '../EVTFIN01Screen'
import { EVTTASK01Screen } from '../EVTTASK01Screen'
import { EVTTASK02Screen } from '../EVTTASK02Screen'
import { evt00b, evt05, evt05b, evt01, evt02b, evt03b } from '../../spec/screens'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

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
          draft={readScopeDraft(scopes, evt00b.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(evt00b.stateScopeKey ?? '', next)}
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
          draft={readScopeDraft(scopes, evt01.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(evt01.stateScopeKey ?? '', next)}
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
      // 초안은 화면 안이 아니라 eventBasicsDraft에 산다.
      return (
        <EVT02BScreen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, evt02b.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(evt02b.stateScopeKey ?? '', next)}
          onScopeEvent={onScopeEvent}
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
          draft={readScopeDraft(scopes, evt03b.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(evt03b.stateScopeKey ?? '', next)}
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
          draft={readScopeDraft(scopes, evt05.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(evt05.stateScopeKey ?? '', next)}
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
          draft={readScopeDraft(scopes, evt05b.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(evt05b.stateScopeKey ?? '', next)}
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
