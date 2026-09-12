import { OPSMEET01AScreen } from '../OPSMEET01AScreen'
import { OPSMEET02Screen } from '../OPSMEET02Screen'
import { OPSMEET03AScreen } from '../OPSMEET03AScreen'
import { OPSMEET04BScreen } from '../OPSMEET04BScreen'
import { OPSMEET05AScreen } from '../OPSMEET05AScreen'
import { OPSMEET06AScreen } from '../OPSMEET06AScreen'
import { OPSMEET06BScreen } from '../OPSMEET06BScreen'
import { OPSMEET07Screen } from '../OPSMEET07Screen'
import { OPSMEET09Screen } from '../OPSMEET09Screen'
import { OPSMEETD01Screen } from '../OPSMEETD01Screen'
import { OPSMEETD02Screen } from '../OPSMEETD02Screen'
import { OPSMEETD03Screen } from '../OPSMEETD03Screen'
import { OPSMEETD04Screen } from '../OPSMEETD04Screen'
import { opsMeet02, opsMeet06b, opsMeetD04 } from '../../spec/screens'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

export const meetingsScreens = [
  {
    screenIds: ['OPS-MEET-01A', 'OPS-MEET-01C'],
    render: ({ screenId, onNavigate }) => {
      // 회의 목록이다. 거르는 값(검색어)은 화면 안에서만 쓰므로 스코프에 담지 않는다.
      //
      // 01C는 **새 회의를 만들 수 있는 사람이 본 같은 화면**이다
      // (meeting.attention의 canCreateMeeting). FIN-00B·EVT-00A2와 같은 자리다.
      return <OPSMEET01AScreen screenId={screenId} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['OPS-MEET-02'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 회의를 만들거나 고친다. 회의 id가 있으면 그것을 읽어 채우고, 없으면 아직
      // 아무것도 적히지 않은 회의를 받아 새로 쓴다(FIN-REQ-01과 같은 겸용 화면).
      return (
        <OPSMEET02Screen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, opsMeet02.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(opsMeet02.stateScopeKey ?? '', next)}
          onNavigate={onNavigate}
          onScopeEvent={onScopeEvent}
        />
      )
    },
  },
  {
    screenIds: ['OPS-MEET-03A', 'OPS-MEET-03B', 'OPS-MEET-03C'],
    render: ({ screenId, screenParams, onNavigate }) => {
      // 예정 회의 상세다. 어느 회의인지는 주소가 실어 온다. **보는 사람에 따라 셋으로
      // 갈린다** — 일반 참가자(03A) · 회의를 만든 사람(03B) · 진행 권한만 받은
      // 사람(03C). 실제로는 주소가 하나이고 데이터가 가른다(meeting.detail의
      // canEdit·canCancel·canManageHostRole·canStart).
      return (
        <OPSMEET03AScreen
          screenParams={screenParams}
          screenId={screenId}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['OPS-MEET-04B'],
    render: ({ screenParams, onNavigate }) => {
      // 진행 권한 관리다. 모달이 아니라 화면인 것은 D03이 이 위에 뜨기 때문이고,
      // 어느 회의의 권한인지는 주소가 실어 온다.
      return <OPSMEET04BScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['OPS-MEET-05A', 'OPS-MEET-05B'],
    render: ({ screenId, screenParams, onNavigate }) => {
      // 진행 중 회의다. 05B는 **이 회의를 진행할 수 있는 사람이 본 같은 화면**이고
      // 실제로는 주소가 하나이며 데이터가 가른다(meeting.detail의 canEnd).
      return (
        <OPSMEET05AScreen
          screenParams={screenParams}
          screenId={screenId}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['OPS-MEET-D01'],
    render: ({ screenParams, onNavigate }) => {
      // 회의 시작 확인 모달이다. 뒤에 03A가 그대로 남는다(명세의 overlay).
      return <OPSMEETD01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['OPS-MEET-D02'],
    render: ({ screenParams, onNavigate }) => {
      // 회의 종료 확인 모달이다. 뒤에 05A가 그대로 남는다(명세의 overlay) —
      // 그림이 그린 배경은 05B이지만 05B는 변형이라 주소가 없다.
      return <OPSMEETD02Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['OPS-MEET-D03'],
    render: ({ screenParams, onNavigate }) => {
      // 진행 권한 부여 확인 모달이다. 넷 중 유일하게 배경이 변형이 아니라 화면이고
      // (04B), 누구에게 주는지까지 주소가 실어 온다.
      return <OPSMEETD03Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['OPS-MEET-D04'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 회의 취소 확인 모달이다. 취소 사유는 화면 안의 상태가 아니라
      // meetingCancelDraft에 담긴다 — payloadScope가 가리키는 자리가 그것이다.
      return (
        <OPSMEETD04Screen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, opsMeetD04.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(opsMeetD04.stateScopeKey ?? '', next)}
          onScopeEvent={onScopeEvent}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['OPS-MEET-06A'],
    render: ({ screenParams, onNavigate }) => {
      // 정리 중 회의다. 읽기만 하는 자리이고, 고쳐 쓰는 쪽은 06B가 갖는다.
      return <OPSMEET06AScreen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['OPS-MEET-06B'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate }) => {
      // **06A와 같은 화면이고 보는 사람이 다르다**(meeting.detail의 canEditMinutes).
      // 다른 변형들과 달리 파일이 따로 있는 것은 겹치는 자리가 너무 적어서다 —
      // 오른쪽 기둥이 통째로 바뀌고 안건 카드도 다르게 펴진다.
      return (
        <OPSMEET06BScreen
          screenParams={screenParams}
          draft={readScopeDraft(scopes, opsMeet06b.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(opsMeet06b.stateScopeKey ?? '', next)}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['OPS-MEET-07', 'OPS-MEET-08'],
    render: ({ screenId, screenParams, onNavigate }) => {
      // 완료 회의록이다. 08은 **참석하지 않은 사람이 본 같은 회의록**이고, 참석했는지
      // 안 했는지는 회의가 끝난 시점에 정해진 사실이라 사람이 그 사이를 오갈 수 없다.
      // 실제로는 주소가 하나이고 데이터가 가른다(meeting.detail의 viewerChipLabel).
      return (
        <OPSMEET07Screen
          screenParams={screenParams}
          screenId={screenId}
          onNavigate={onNavigate}
        />
      )
    },
  },
  {
    screenIds: ['OPS-MEET-09'],
    render: ({ screenParams, onNavigate }) => {
      // 취소된 회의 상세다. 무엇의 상세인지는 화면 안에 없고 주소가 실어 온다.
      return <OPSMEET09Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
] satisfies readonly ScreenRegistration[]
