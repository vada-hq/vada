import { PageCard } from '../components/PageCard'
import { EVT00AScreen } from './EVT00AScreen'
import { EVT02Screen } from './EVT02Screen'
import { EVTDOC01Screen } from './EVTDOC01Screen'
import { EVTMEET01Screen } from './EVTMEET01Screen'
import { EVTSCHED01Screen } from './EVTSCHED01Screen'
import { EVT04Screen } from './EVT04Screen'
import { EVTFIN01Screen } from './EVTFIN01Screen'
import { FINREQ01Screen } from './FINREQ01Screen'
import { FINREQ02Screen } from './FINREQ02Screen'
import { MYREQ01Screen } from './MYREQ01Screen'
import { EVTTASK01Screen } from './EVTTASK01Screen'
import { EVTTASK02Screen } from './EVTTASK02Screen'
import { HOME01KScreen } from './HOME01KScreen'
import { INV01Screen } from './INV01Screen'
import { MY01Screen } from './MY01Screen'
import { OPS00Screen } from './OPS00Screen'
import { OPSMEET01AScreen } from './OPSMEET01AScreen'
import { TASK01Screen } from './TASK01Screen'
import { ONB01Screen } from './ONB01Screen'
import { ONB02Screen } from './ONB02Screen'
import { ORG01Screen } from './ORG01Screen'
import { ORG02Screen } from './ORG02Screen'
import { inv01, onb01, org01, org02 } from '../spec/screens'
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
export function ScreenRouter({
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
  if (screenId === 'OPS-MEET-01A') {
    // 회의 목록이다. 거르는 값(검색어)은 화면 안에서만 쓰므로 스코프에 담지 않는다.
    return <OPSMEET01AScreen onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-02') {
    // 행사 개요다. 행사 작업 공간의 첫 갈피이고, 어느 행사인지는 주소가 실어 온다.
    return <EVT02Screen screenParams={screenParams} onNavigate={onNavigate} />
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
        onNavigate={onNavigate}
        onScopeEvent={onScopeEvent}
      />
    )
  }
  if (screenId === 'FIN-REQ-02') return <FINREQ02Screen screenParams={screenParams} onNavigate={onNavigate} />
  if (screenId === 'MY-REQ-01') return <MYREQ01Screen screenParams={screenParams} onNavigate={onNavigate} />
  if (screenId === 'EVT-TASK-01') {
    // 행사 업무 보드다. 어느 행사인지는 화면 안에 없고 주소가 실어 온다.
    return <EVTTASK01Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-TASK-02') {
    // 상세 화면이다. 무엇의 상세인지는 화면 안에 없고 주소가 실어 온다.
    return <EVTTASK02Screen screenParams={screenParams} onNavigate={onNavigate} />
  }
  if (screenId === 'EVT-00A') {
    // 행사 목록이다. 거르는 값(검색어·진행 단계)은 화면 안에서만 쓴다.
    return <EVT00AScreen onNavigate={onNavigate} />
  }
  if (screenId === 'TASK-01') {
    // 칸반 보드다. 보는 범위는 목록을 거르는 화면 안의 값이라 스코프에 담지 않는다.
    return <TASK01Screen onNavigate={onNavigate} />
  }
  if (screenId === 'ONB-02') {
    return <ONB02Screen onNavigate={onNavigate} />
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
