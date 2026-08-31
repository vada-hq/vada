import { PageCard } from '../components/PageCard'
import { EXT01AScreen } from './EXT01AScreen'
import { EXT01BScreen } from './EXT01BScreen'
import { EXT02AScreen } from './EXT02AScreen'
import { EXT02BScreen } from './EXT02BScreen'
import { EXT02CScreen } from './EXT02CScreen'
import { EVT00AScreen } from './EVT00AScreen'
import { FIN00Screen } from './FIN00Screen'
import { INV00Screen } from './INV00Screen'
import { OPSCAL01Screen } from './OPSCAL01Screen'
import { FINLEDGER01Screen } from './FINLEDGER01Screen'
import { MSG01Screen } from './MSG01Screen'
import { MSG02Screen } from './MSG02Screen'
import { MSG03Screen } from './MSG03Screen'
import { REC01Screen } from './REC01Screen'
import { REC02Screen } from './REC02Screen'
import { REC02AScreen } from './REC02AScreen'
import { EVT02Screen } from './EVT02Screen'
import { EVT00BScreen } from './EVT00BScreen'
import { EVT01Screen } from './EVT01Screen'
import { EVT02BScreen } from './EVT02BScreen'
import { EVT02CScreen } from './EVT02CScreen'
import { EVT02DScreen } from './EVT02DScreen'
import { EVT02EScreen } from './EVT02EScreen'
import { EVT03AScreen } from './EVT03AScreen'
import { EVT03BScreen } from './EVT03BScreen'
import { EVT04BScreen } from './EVT04BScreen'
import { EVTDOC01Screen } from './EVTDOC01Screen'
import { EVTMEET01Screen } from './EVTMEET01Screen'
import { EVTSCHED01Screen } from './EVTSCHED01Screen'
import { EVT04Screen } from './EVT04Screen'
import { EVT05Screen } from './EVT05Screen'
import { EVT05BScreen } from './EVT05BScreen'
import { EVTFIN01Screen } from './EVTFIN01Screen'
import { FINREQ01Screen } from './FINREQ01Screen'
import { FINREQ02Screen } from './FINREQ02Screen'
import { MYREQ01Screen } from './MYREQ01Screen'
import { FINSUP01Screen } from './FINSUP01Screen'
import { FINREV01Screen } from './FINREV01Screen'
import { FINEVID01Screen } from './FINEVID01Screen'
import { FINPROC01Screen } from './FINPROC01Screen'
import { EVTTASK01Screen } from './EVTTASK01Screen'
import { EVTTASK02Screen } from './EVTTASK02Screen'
import { HOME01KScreen } from './HOME01KScreen'
import { INV01Screen } from './INV01Screen'
import { MY01Screen } from './MY01Screen'
import { OPS00Screen } from './OPS00Screen'
import { OPSMEET01AScreen } from './OPSMEET01AScreen'
import { OPSMEET02Screen } from './OPSMEET02Screen'
import { OPSMEET03AScreen } from './OPSMEET03AScreen'
import { OPSMEET04BScreen } from './OPSMEET04BScreen'
import { OPSMEET05AScreen } from './OPSMEET05AScreen'
import { OPSMEET06AScreen } from './OPSMEET06AScreen'
import { OPSMEET06BScreen } from './OPSMEET06BScreen'
import { OPSMEET07Screen } from './OPSMEET07Screen'
import { OPSMEET09Screen } from './OPSMEET09Screen'
import { OPSMEETD01Screen } from './OPSMEETD01Screen'
import { OPSMEETD02Screen } from './OPSMEETD02Screen'
import { OPSMEETD03Screen } from './OPSMEETD03Screen'
import { OPSMEETD04Screen } from './OPSMEETD04Screen'
import { TASK01Screen } from './TASK01Screen'
import { ONB01Screen } from './ONB01Screen'
import { ONB02Screen } from './ONB02Screen'
import { ORG00Screen } from './ORG00Screen'
import { ORG01Screen } from './ORG01Screen'
import { ORG03AScreen } from './ORG03AScreen'
import { ORG03BScreen } from './ORG03BScreen'
import { ORG03CScreen } from './ORG03CScreen'
import { ORG04Screen } from './ORG04Screen'
import { ORG04BScreen } from './ORG04BScreen'
import { ORG07AScreen } from './ORG07AScreen'
import { ORG07BScreen } from './ORG07BScreen'
import { ORG07CScreen } from './ORG07CScreen'
import { ORG02Screen } from './ORG02Screen'
import {
  evt00b,
  org04b,
  ext01a,
  ext02a,
  rec02,
  rec02a,
  inv00,
  evt05,
  evt05b,
  msg02,
  evt01,
  evt02b,
  evt03b,
  finReq01,
  finRev01,
  finSup01,
  inv01,
  onb01,
  opsMeet02,
  opsMeet06b,
  opsMeetD04,
  org01,
  org02,
  org03b,
} from '../spec/screens'
import { ALL_SCREENS } from '../spec/screens'
import { dataSourceCallsOf } from '../spec/screen-sources'
import { useSourceLoading } from '../data-sources/loading'
import { readScopeDraft } from '../state/scopes'
import type { ScopeDraft, ScopeStore } from '../state/scopes'

interface ScreenRouterProps {
  screenId: string
  // 주소가 실어 온 화면 인자. 상세 화면만 쓴다(screen.json의 params).
  screenParams?: Record<string, string>
  scopes: ScopeStore
  onChangeScope: (scopeKey: string, next: ScopeDraft) => void
  // 이동하면서 인자를 함께 넘긴다 — 칸반 카드가 '어느 업무인지'를 준다.
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  // 상태 스코프의 수명 이벤트. 제출 성공 시 action.onSuccess.scopeEvent로만 발생한다.
  onScopeEvent?: (scopeKey: string, event: 'complete' | 'cancel') => void
}

// 내비게이션 계약(element-types.md): 스펙의 targetScreenId가 구현에 등록되지
// 않은 화면이면 조용한 대체 없이 명시적 오류를 표시한다.
// 각 화면에는 자기 stateScopeKey의 초안을 전달한다. 여기에 더해, 부품 표를 쓰는
// 화면은 scopes 전체도 받는다 — note가 *다른* 스코프의 값을 읽기 때문이다.
// 지금 note가 없는 화면에도 넘긴다: 화면이 정하는 것은 자리뿐이어야 하고,
// note가 하나 생겼다고 배선을 다시 손볼 자리가 있으면 안 된다.
/**
 * 받아 오는 동안과 실패했을 때를 **그릇이 그린다.**
 *
 * 카탈로그가 출처마다 `loading`·`error`를 갖는데 화면은 `empty`만 읽고 있었다.
 * 까닭은 문구를 빠뜨린 것이 아니라 읽기가 전부 동기라서였다 — 기다리는 시간도
 * 실패할 통신도 없으면 그 두 문구가 그려질 순간이 없다(data-sources/loading.ts).
 *
 * 무엇을 기다리는지는 **명세가 안다.** 화면 코드를 읽지 않고 `dataSourceCallsOf`가
 * 답한다 — 무엇을 부르는지뿐 아니라 **어떤 인자로** 부르는지까지. 개발용 응답은
 * 기본적으로 즉시 답하므로 평소에는 이 자리를 스치고 지나간다 — 늦음과 실패는
 * 그것을 시험하는 검사가 켠다.
 *
 * 인자는 두 곳에서 온다. 주소가 실어 온 것(`screenParams`)과 이 화면의 스코프 초안이다.
 * **화면 컴포넌트 안의 `useState`는 여기서 안 보인다** — 검색어와 거르개가 그렇고,
 * 그 자리는 아직 서버로 못 부른다(`fromServer`가 터뜨린다).
 */
export function ScreenRouter(props: ScreenRouterProps) {
  const spec = ALL_SCREENS.find((entry) => entry.screenId === props.screenId)
  const draft = spec?.stateScopeKey === undefined ? undefined : props.scopes[spec.stateScopeKey]
  const loading = useSourceLoading(
    spec === undefined
      ? []
      : dataSourceCallsOf(spec, {
          screenParams: props.screenParams ?? {},
          ...(draft === undefined ? {} : { fields: draft.values }),
        }),
  )

  if (loading.status !== 'ready') {
    const isError = loading.status === 'error'
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6">
        <div
          role={isError ? 'alert' : 'status'}
          className={`max-w-md text-center text-sm ${isError ? 'text-red-700' : 'text-gray-600'}`}
        >
          {loading.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      </div>
    )
  }
  return <ScreenBody {...props} />
}

function ScreenBody({
  screenId,
  screenParams = {},
  scopes,
  onChangeScope,
  onNavigate,
  onScopeEvent = () => {},
}: ScreenRouterProps) {
  if (screenId === 'ONB-01') {
    return (
      <ONB01Screen
        draft={readScopeDraft(scopes, onb01.stateScopeKey)}
        scopes={scopes}
        onChangeDraft={(next) => onChangeScope(onb01.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
      />
    )
  }
  if (screenId === 'INV-01') {
    return (
      <INV01Screen
        screenParams={screenParams}
        draft={readScopeDraft(scopes, inv01.stateScopeKey)}
        scopes={scopes}
        onChangeDraft={(next) => onChangeScope(inv01.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
      />
    )
  }
  if (screenId === 'HOME-01K') {
    // 읽기 전용 대시보드다. 상태 스코프를 참조하지 않는다.
    return <HOME01KScreen onNavigate={onNavigate} />
  }
  if (screenId === 'MY-01') {
    // 대시보드와 같은 읽기 화면이다. 탭·검색어는 목록을 거르는 화면 안의 값이라
    // 상태 스코프(화면 간 유지)에 담지 않는다.
    return <MY01Screen onNavigate={onNavigate} />
  }
  if (screenId === 'OPS-00') {
    // 운영 허브다. 고를 것은 갈 곳뿐이라 상태 스코프를 참조하지 않는다.
    return <OPS00Screen onNavigate={onNavigate} />
  }
  if (screenId === 'OPS-MEET-01A' || screenId === 'OPS-MEET-01C') {
    // 회의 목록이다. 거르는 값(검색어)은 화면 안에서만 쓰므로 스코프에 담지 않는다.
    //
    // 01C는 **새 회의를 만들 수 있는 사람이 본 같은 화면**이다
    // (meeting.attention의 canCreateMeeting). FIN-00B·EVT-00A2와 같은 자리다.
    return <OPSMEET01AScreen screenId={screenId} onNavigate={onNavigate} />
  }
  if (screenId === 'OPS-MEET-02') {
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
  }
  if (
    screenId === 'OPS-MEET-03A' ||
    screenId === 'OPS-MEET-03B' ||
    screenId === 'OPS-MEET-03C'
  ) {
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
  }
  if (screenId === 'OPS-MEET-04B') {
    // 진행 권한 관리다. 모달이 아니라 화면인 것은 D03이 이 위에 뜨기 때문이고,
    // 어느 회의의 권한인지는 주소가 실어 온다.
    return <OPSMEET04BScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'OPS-MEET-05A' || screenId === 'OPS-MEET-05B') {
    // 진행 중 회의다. 05B는 **이 회의를 진행할 수 있는 사람이 본 같은 화면**이고
    // 실제로는 주소가 하나이며 데이터가 가른다(meeting.detail의 canEnd).
    return (
      <OPSMEET05AScreen
        screenParams={screenParams}
        screenId={screenId}
        onNavigate={onNavigate}
      />
    )
  }
  if (screenId === 'OPS-MEET-D01') {
    // 회의 시작 확인 모달이다. 뒤에 03A가 그대로 남는다(명세의 overlay).
    return <OPSMEETD01Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'OPS-MEET-D02') {
    // 회의 종료 확인 모달이다. 뒤에 05A가 그대로 남는다(명세의 overlay) —
    // 그림이 그린 배경은 05B이지만 05B는 변형이라 주소가 없다.
    return <OPSMEETD02Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'OPS-MEET-D03') {
    // 진행 권한 부여 확인 모달이다. 넷 중 유일하게 배경이 변형이 아니라 화면이고
    // (04B), 누구에게 주는지까지 주소가 실어 온다.
    return <OPSMEETD03Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'OPS-MEET-D04') {
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
  }
  if (screenId === 'OPS-MEET-06A') {
    // 정리 중 회의다. 읽기만 하는 자리이고, 고쳐 쓰는 쪽은 06B가 갖는다.
    return <OPSMEET06AScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'OPS-MEET-06B') {
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
  }
  if (screenId === 'OPS-MEET-07' || screenId === 'OPS-MEET-08') {
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
  }
  if (screenId === 'OPS-MEET-09') {
    // 취소된 회의 상세다. 무엇의 상세인지는 화면 안에 없고 주소가 실어 온다.
    return <OPSMEET09Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-02') {
    // 행사 개요다. 행사 작업 공간의 첫 갈피이고, 어느 행사인지는 주소가 실어 온다.
    return <EVT02Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'INV-00') {
    // 초대 코드는 화면 안이 아니라 onboardingDraft에 담긴다 — INV-01이 같은
    // 스코프를 쓰므로 넘어가서도 남는다.
    return (
      <INV00Screen
        draft={readScopeDraft(scopes, inv00.stateScopeKey)}
        scopes={scopes}
        onChangeDraft={(next) => onChangeScope(inv00.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
      />
    )
  }
  if (screenId === 'OPS-CAL-01') {
    // 읽기 전용 캘린더다. 좁혀 보는 값은 화면 안의 조회 인자라 스코프에 담지 않는다.
    return <OPSCAL01Screen onNavigate={onNavigate} />
  }
  if (screenId === 'EXT-01A') {
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
  }
  if (screenId === 'EXT-01B') {
    // 참석 확인의 결과. **한 사람에게 하나만 온다** — 그림이 여섯을 나란히 그린
    // 것은 값의 나열이고, 명세가 source.alsoDrawnAt으로 그 사실을 든다.
    return <EXT01BScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EXT-02A') {
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
  }
  if (screenId === 'EXT-02B') {
    // 신청을 마치고 보는 화면. **나가는 단추가 아예 없어** onNavigate도 받지
    // 않는다 — 이 저장소의 첫 막다른 화면이다.
    return <EXT02BScreen screenParams={screenParams} />
  }
  if (screenId === 'EXT-02C') {
    // 막힌 설문 링크의 안내. 다섯 상태 중 하나만 그려지고, 그중 하나(교체됨)만
    // 갈 곳이 있다 — 새 설문의 신청 폼.
    return <EXT02CScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'FIN-00' || screenId === 'FIN-00B') {
    // 조직 전체 재정이다. 사이드바의 '재정'이 가리키는 화면이라 인자를 받지 않는다.
    // **행사 아래의 재정(FIN-REQ-* 계열)과 다른 자리다** — 저쪽은 운영 아래에 있다.
    //
    // **FIN-00B는 다른 화면이 아니라 다른 사람이 본 같은 화면이다.** 실제로는
    // 주소가 하나이고 데이터가 가른다(finance.overviewViewer의 canPlanBudget).
    // 여기 이름을 둔 것은 이 저장소에 로그인한 사람이 없어서다 — 두 그림을 다
    // 열어 볼 수 있어야 대조가 둘 다 본다.
    return <FIN00Screen screenId={screenId} onNavigate={onNavigate} />
  }
  if (screenId === 'FIN-LEDGER-01') {
    // 그 아래의 장부. 거르는 값은 전부 화면 안의 조회 인자다.
    return <FINLEDGER01Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'REC-01') {
    // 셸의 '기록' 메뉴가 가리키는 화면 자신이다 — 그래서 activeNavigationScreenId가 없다.
    // 검색어는 목록을 거르는 화면 안의 값이라 스코프에 담지 않는다.
    return <REC01Screen onNavigate={onNavigate} />
  }
  if (screenId === 'REC-02') {
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
  }
  if (screenId === 'REC-02A') {
    // 아카이브를 쓰고 검토받는다. 쓰는 칸은 전부 archiveDraft에 산다.
    return (
      <REC02AScreen
        screenParams={screenParams}
        draft={readScopeDraft(scopes, rec02a.stateScopeKey)}
        onChangeDraft={(next) => onChangeScope(rec02a.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
      />
    )
  }
  if (screenId === 'MSG-01') {
    // 셸의 '메시지' 메뉴가 가리키는 화면 자신이다 — 그래서 activeNavigationScreenId가 없다.
    return <MSG01Screen onNavigate={onNavigate} />
  }
  if (screenId === 'MSG-02') {
    // 새 메시지 방 만들기 모달이다. 뒤에 MSG-01이 그대로 남는다(명세의 overlay).
    return (
      <MSG02Screen
        draft={readScopeDraft(scopes, msg02.stateScopeKey)}
        onChangeDraft={(next) => onChangeScope(msg02.stateScopeKey ?? '', next)}
        onScopeEvent={onScopeEvent}
        onNavigate={onNavigate}
      />
    )
  }
  if (screenId === 'MSG-03') {
    // 대화. 메뉴가 가리키는 화면이 아니라 그 아래다(activeNavigationScreenId: MSG-01).
    return <MSG03Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-00B') {
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
  }
  if (screenId === 'EVT-01') {
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
  }
  if (screenId === 'EVT-02B') {
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
  }
  if (screenId === 'EVT-02C') {
    // 행사 종료 권한 없음 모달이다. 뒤에 행사 개요(EVT-02)가 그대로 남는다.
    // 보낼 것도 고를 것도 없다 — 누가 할 수 있는지를 서버에게 묻고 알릴 뿐이다.
    return <EVT02CScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-02E') {
    // 행사 완료 처리 확인 모달이다. 뒤에 후속 정리 중 개요(EVT-02D)가 남는다.
    // 살펴 준 한 줄은 막지 않는다(meeting.endConfirm과 같은 자리).
    return <EVT02EScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-02D') {
    // 후속 정리 중인 행사의 개요다. EVT-02와 같은 '개요' 갈피에서 열리지만 겹치는
    // 것이 둘뿐이고 그 둘조차 다르다 - 상태가 화면을 가른다.
    return <EVT02DScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-03A') {
    // 행사 운영 조직이다. '인원 관리' 갈피 아래로 한 겹 더 들어간 화면이고,
    // 어느 행사인지는 주소가 실어 온다.
    return <EVT03AScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-03B') {
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
  }
  if (screenId === 'EVT-04B') {
    // 참석 확인 QR 모달이다. 뒤에 EVT-04가 그대로 남는다(명세: overlay).
    // QR은 행사 상태와 따로 켜고 끄므로 뒤 화면의 상태를 읽지 않는다.
    return <EVT04BScreen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-DOC-01') {
    // 행사 문서다. 작업 공간의 세 번째 갈피이고, 어느 행사인지는 주소가 실어 온다.
    return <EVTDOC01Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-MEET-01') {
    // 행사 관련 회의다. 작업 공간의 네 번째 갈피이고, 어느 행사인지는 주소가 실어 온다.
    return <EVTMEET01Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-SCHED-01') {
    // 행사 일정이다. 작업 공간의 다섯 번째 갈피이고, 어느 행사인지는 주소가 실어 온다.
    return <EVTSCHED01Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-04') {
    // 행사 참가자 명단이다. 작업 공간의 여섯 번째 갈피이고, 어느 행사인지는 주소가 실어 온다.
    return <EVT04Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-05') {
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
  }
  if (screenId === 'EVT-05B') {
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
  }
  if (screenId === 'EVT-FIN-01') {
    // 행사 재정이다. 작업 공간의 일곱 번째이자 마지막 갈피다.
    return <EVTFIN01Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'FIN-REQ-01') {
    // 구매 요청을 쓰거나 고친다. 요청 id가 있으면 그것을 읽어 채우고, 없으면
    // 아직 아무것도 적히지 않은 요청을 받아 새로 쓴다.
    return (
      <FINREQ01Screen
        screenParams={screenParams}
        draft={readScopeDraft(scopes, finReq01.stateScopeKey)}
        onChangeDraft={(next) => onChangeScope(finReq01.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
        onScopeEvent={onScopeEvent}
      />
    )
  }
  if (screenId === 'FIN-REQ-02') return <FINREQ02Screen screenParams={screenParams} onNavigate={onNavigate} />
  if (screenId === 'MY-REQ-01') return <MYREQ01Screen screenParams={screenParams} onNavigate={onNavigate} />
  if (screenId === 'FIN-SUP-01') return (
    <FINSUP01Screen
      screenParams={screenParams}
      draft={readScopeDraft(scopes, finSup01.stateScopeKey)}
      onChangeDraft={(next) => onChangeScope(finSup01.stateScopeKey ?? '', next)}
      onScopeEvent={onScopeEvent}
      onNavigate={onNavigate}
    />
  )
  if (screenId === 'FIN-REV-01') return (
    <FINREV01Screen
      screenParams={screenParams}
      draft={readScopeDraft(scopes, finRev01.stateScopeKey)}
      onChangeDraft={(next) => onChangeScope(finRev01.stateScopeKey ?? '', next)}
      onScopeEvent={onScopeEvent}
      onNavigate={onNavigate}
    />
  )
  if (screenId === 'FIN-EVID-01') return <FINEVID01Screen screenParams={screenParams} onNavigate={onNavigate} />
  if (screenId === 'FIN-PROC-01') return <FINPROC01Screen screenParams={screenParams} onNavigate={onNavigate} />
  if (screenId === 'EVT-TASK-01') {
    // 행사 업무 보드다. 어느 행사인지는 화면 안에 없고 주소가 실어 온다.
    return <EVTTASK01Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-TASK-02') {
    // 상세 화면이다. 무엇의 상세인지는 화면 안에 없고 주소가 실어 온다.
    return <EVTTASK02Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-00A' || screenId === 'EVT-00A2') {
    // 행사 목록이다. 거르는 값(검색어·진행 단계)은 화면 안에서만 쓴다.
    //
    // EVT-00A2는 다른 화면이 아니라 **새 행사를 만들 수 있는 사람이 본 같은 화면**
    // 이다(event.listViewer의 canCreateEvent). FIN-00B와 같은 자리다.
    return <EVT00AScreen screenId={screenId} onNavigate={onNavigate} />
  }
  if (screenId === 'TASK-01') {
    // 칸반 보드다. 보는 범위는 목록을 거르는 화면 안의 값이라 스코프에 담지 않는다.
    return <TASK01Screen onNavigate={onNavigate} />
  }
  if (screenId === 'ONB-02') {
    return <ONB02Screen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-00') {
    // 읽기 전용 허브다. 상태 스코프를 참조하지 않는다.
    return <ORG00Screen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-03A') {
    // 저장된 조직도를 읽는 화면이다. 상태 스코프를 참조하지 않는다.
    return <ORG03AScreen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-03B') {
    return (
      <ORG03BScreen
        draft={readScopeDraft(scopes, org03b.stateScopeKey)}
        onChangeDraft={(next) => onChangeScope(org03b.stateScopeKey ?? '', next)}
        onScopeEvent={onScopeEvent}
        onNavigate={onNavigate}
      />
    )
  }
  if (screenId === 'ORG-03C') {
    // 조직도 곁에 붙는 칸이다. 초대 값은 서버가 만들고 화면은 담지 않는다.
    return <ORG03CScreen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-04') {
    // 읽기만 하는 화면이다. 역할을 바꾸는 것은 ORG-04B다.
    return <ORG04Screen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-04B') {
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
  }
  if (screenId === 'ORG-07A') {
    return <ORG07AScreen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-07B') {
    // 모달이다. 뒤에 ORG-07A가 그대로 남는다(명세: overlay).
    return <ORG07BScreen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-07C') {
    return <ORG07CScreen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-01') {
    return (
      <ORG01Screen
        draft={readScopeDraft(scopes, org01.stateScopeKey)}
        scopes={scopes}
        onChangeDraft={(next) => onChangeScope(org01.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
      />
    )
  }

  if (screenId === 'ORG-02') {
    return (
      <ORG02Screen
        draft={readScopeDraft(scopes, org02.stateScopeKey)}
        onChangeDraft={(next) => onChangeScope(org02.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
        onScopeEvent={onScopeEvent}
      />
    )
  }

  return (
    <PageCard>
      <h1 className="text-lg font-semibold text-red-500">구현에 등록되지 않은 화면입니다</h1>
      <p className="pt-1 text-sm text-gray-500">
        스펙이 <code className="text-gray-800">{screenId}</code> 화면으로 이동을 선언했지만, 이
        화면은 아직 구현에 등록되지 않았습니다.
      </p>
      <div className="pt-6">
        <button
          type="button"
          onClick={() => onNavigate('ONB-01')}
          className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          처음 화면으로 돌아가기
        </button>
      </div>
    </PageCard>
  )
}
