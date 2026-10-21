import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createChatRoutes } from './chat/routes.js'
import type { createCouncilRoutes } from './councils/routes.js'
import type { createInviteRoutes } from './invites/routes.js'
import type { createPushDeviceRoutes } from './push/devices.js'
import type { createPushRoutes } from './push/routes.js'
import type { createBudgetRoutes } from './budget/routes.js'
import type { createPurchaseRoutes } from './purchases/routes.js'
import type { createTaskRoutes } from './tasks/routes.js'
import type { createTeamRoutes } from './team/routes.js'
import { handleError } from './http/on-error.js'
import { limitBody, mutationGuard } from './http/guard.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  // 학생회: 내 학생회 목록, 만들기, 보기, 설정, 기수
  councils?: ReturnType<typeof createCouncilRoutes>
  // 초대: 초대 확인, 들어오기, 초대 코드 보기와 바꾸기
  invites?: ReturnType<typeof createInviteRoutes>
  // 운영진: 목록, 부서 배정과 빼기, 직급, 회장 넘기기, 내보내기, 부서
  team?: ReturnType<typeof createTeamRoutes>
  // 대화: 방 목록, 메시지 읽기, 공지, 읽음
  chat?: ReturnType<typeof createChatRoutes>
  // 휴대폰 알림. 알림 열쇠(VAPID)가 없으면 만들지 않는다.
  push?: ReturnType<typeof createPushRoutes> | undefined
  // 알림 받을 기기 저장과 지우기
  pushDevices?: ReturnType<typeof createPushDeviceRoutes>
  // 업무: 목록, 하나 읽기
  tasks?: ReturnType<typeof createTaskRoutes>
  // 구매 요청: 목록, 하나 읽기, 내기, 취소, 결재
  purchases?: ReturnType<typeof createPurchaseRoutes>
  // 회계 기간과 지출 예산 항목
  budget?: ReturnType<typeof createBudgetRoutes>
}

export function createApp({
  auth,
  trustedOrigin,
  councils,
  invites,
  team,
  chat,
  push,
  pushDevices,
  tasks,
  purchases,
  budget,
}: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
  // 로그인 없이 쓰는 공개 경로(참가 신청)도 같은 화면에서만 보내므로 같은 가드를 건다.
  app.use('/api/public/*', mutationGuard(trustedOrigin))
  app.get('/api/health', c => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', c => auth.handler(c.req.raw))
  if (councils) app.route('/api', councils)
  if (invites) app.route('/api', invites)
  if (team) app.route('/api', team)
  if (chat) app.route('/api', chat)
  if (push) app.route('/api', push)
  if (pushDevices) app.route('/api', pushDevices)
  if (tasks) app.route('/api', tasks)
  if (purchases) app.route('/api', purchases)
  if (budget) app.route('/api', budget)
  app.onError(handleError)
  return app
}
