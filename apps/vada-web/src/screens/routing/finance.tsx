import { FIN00Screen } from '../FIN00Screen'
import { FINLEDGER01Screen } from '../FINLEDGER01Screen'
import { FINPLAN01Screen } from '../FINPLAN01Screen'
import { FINREQ01Screen } from '../FINREQ01Screen'
import { FINREQ02Screen } from '../FINREQ02Screen'
import { MYREQ01Screen } from '../MYREQ01Screen'
import { FINSUP01Screen } from '../FINSUP01Screen'
import { FINREV01Screen } from '../FINREV01Screen'
import { FINEVID01Screen } from '../FINEVID01Screen'
import { FINPROC01Screen } from '../FINPROC01Screen'
import { finPlan01, finReq01, finRev01, finSup01 } from '../../spec/screens'
import { readScopeDraft } from '../../state/scopes'
import type { ScreenRegistration } from './types'

export const financeScreens = [
  {
    screenIds: ['FIN-00', 'FIN-00B'],
    render: ({ screenId, onNavigate }) => {
      // 조직 전체 재정이다. 사이드바의 '재정'이 가리키는 화면이라 인자를 받지 않는다.
      // **행사 아래의 재정(FIN-REQ-* 계열)과 다른 자리다** — 저쪽은 운영 아래에 있다.
      //
      // **FIN-00B는 다른 화면이 아니라 다른 사람이 본 같은 화면이다.** 실제로는
      // 주소가 하나이고 데이터가 가른다(finance.overviewViewer의 canPlanBudget).
      // 여기 이름을 둔 것은 이 저장소에 로그인한 사람이 없어서다 — 두 그림을 다
      // 열어 볼 수 있어야 대조가 둘 다 본다.
      return <FIN00Screen screenId={screenId} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['FIN-LEDGER-01'],
    render: ({ screenParams, onNavigate }) => {
      // 그 아래의 장부. 거르는 값은 전부 화면 안의 조회 인자다.
      return <FINLEDGER01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['FIN-REQ-01'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
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
    },
  },
  {
    screenIds: ['FIN-PLAN-01'],
    render: ({ scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      // 예산 편성이다. 학생회에 한 벌이라 인자가 없고, 초안은 저장된 편성에서 시작한다.
      return (
        <FINPLAN01Screen
          draft={readScopeDraft(scopes, finPlan01.stateScopeKey)}
          onChangeDraft={(next) => onChangeScope(finPlan01.stateScopeKey ?? '', next)}
          onNavigate={onNavigate}
          onScopeEvent={onScopeEvent}
        />
      )
    },
  },
  {
    screenIds: ['FIN-REQ-02'],
    render: ({ screenParams, onNavigate }) => {
      return <FINREQ02Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['MY-REQ-01'],
    render: ({ screenParams, onNavigate }) => {
      return <MYREQ01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['FIN-SUP-01'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      return (
          <FINSUP01Screen
            screenParams={screenParams}
            draft={readScopeDraft(scopes, finSup01.stateScopeKey)}
            onChangeDraft={(next) => onChangeScope(finSup01.stateScopeKey ?? '', next)}
            onScopeEvent={onScopeEvent}
            onNavigate={onNavigate}
          />
        )
    },
  },
  {
    screenIds: ['FIN-REV-01'],
    render: ({ screenParams, scopes, onChangeScope, onNavigate, onScopeEvent }) => {
      return (
          <FINREV01Screen
            screenParams={screenParams}
            draft={readScopeDraft(scopes, finRev01.stateScopeKey)}
            onChangeDraft={(next) => onChangeScope(finRev01.stateScopeKey ?? '', next)}
            onScopeEvent={onScopeEvent}
            onNavigate={onNavigate}
          />
        )
    },
  },
  {
    screenIds: ['FIN-EVID-01'],
    render: ({ screenParams, onNavigate }) => {
      return <FINEVID01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
  {
    screenIds: ['FIN-PROC-01'],
    render: ({ screenParams, onNavigate }) => {
      return <FINPROC01Screen screenParams={screenParams} onNavigate={onNavigate} />
    },
  },
] satisfies readonly ScreenRegistration[]
