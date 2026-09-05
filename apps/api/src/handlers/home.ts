import type { Context } from 'hono'
import { orgOf, type Handlers } from '../deps.ts'
import {
  homeBriefing,
  homeBriefingNotices,
  homeEventCounts,
  homeEvents,
  homeFinanceSummary,
  homeOrgAlerts,
  homeSchedules,
} from '../home/home.ts'
import { NotFound } from '../routes.ts'

// 홈(HOME-01K).
//
// **홈은 여러 표를 가로질러 센다.** 행사도 회의도 업무도 아닌, 그 전부의 요약이다.
// 그래서 어느 영역에도 넣지 않는다.
//
// **재정 요약도 여기 온다**(`home.financeSummary`). 한동안 예산을 정하는 화면이 명세에
// 없어 그 자리만 화면에서 따로 가려졌는데(`Built`), 예산 편성 화면(FIN-PLAN-01)이
// 수입원과 배정을 넣게 되어 셀 바탕이 생겼다.

/** 지금 보는 사람이 이 학생회에서 누구인가. **인사에 그 사람의 이름이 들어간다.** */
function memberOf(c: Context): string {
  const memberId = c.get('sender')?.membership?.memberId
  if (memberId === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')
  return memberId
}

export const homeHandlers: Handlers = {
  // ── 끼룩이 브리핑 ──────────────────────────────────────────────────────
  //
  // 보는 사람 자신의 이름이 들어가는 문장이다 — 그 사람이 정보주체다.
  'home.briefing': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'user', id: c.get('sender')!.userId })
    return homeBriefing(d.db, orgId, memberOf(c), d.invite.now())
  },
  'home.briefingNotices': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return homeBriefingNotices(d.db, orgId, d.invite.now())
  },

  // ── 행사·일정 ──────────────────────────────────────────────────────────
  'home.eventCounts': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return homeEventCounts(d.db, orgId, d.invite.now())
  },
  'home.events': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return homeEvents(d.db, orgId, d.invite.now())
  },
  'home.schedules': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return homeSchedules(d.db, orgId, d.invite.now())
  },

  // ── 조직 주요 알림 ─────────────────────────────────────────────────────
  'home.orgAlerts': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return homeOrgAlerts(d.db, orgId)
  },

  // ── 전체 재정 요약 ─────────────────────────────────────────────────────
  //
  // 학생회 전체를 센다 — 행사 하나의 재정(`event.financeSummary`)과 다른 물건이다.
  'home.financeSummary': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return homeFinanceSummary(d.db, orgId)
  },
}
