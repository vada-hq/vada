import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createAgreement } from './agreement/routes.js'
import type { createChatRoutes } from './chat/routes.js'
import type { createCouncilRoutes } from './councils/routes.js'
import type { createInviteRoutes } from './invites/routes.js'
import type { createPushDeviceRoutes } from './push/devices.js'
import type { createPushRoutes } from './push/routes.js'
import type { createProfileRoutes } from './profile/routes.js'
import type { createBudgetRoutes } from './budget/routes.js'
import type { createAccountRoutes } from './accounts/routes.js'
import type { createEventRoutes } from './events/routes.js'
import type { createPublicRegistrationRoutes } from './registrations/public-routes.js'
import type { createDepositRoutes } from './deposits/routes.js'
import type { createSettlementRoutes } from './settlement/routes.js'
import type { createRegistrationRoutes } from './registrations/routes.js'
import type { createFeePaymentRoutes } from './fee-payments/routes.js'
import type { createExpenseRoutes } from './expenses/routes.js'
import type { createIncomeRoutes } from './incomes/routes.js'
import type { createClosingRoutes } from './closing/routes.js'
import type { createClosingExportRoutes } from './closing/export-routes.js'
import type { createPurchaseRoutes } from './purchases/routes.js'
import type { createHomeRoutes } from './home/routes.js'
import type { createTaskRoutes } from './tasks/routes.js'
import type { createTeamRoutes } from './team/routes.js'
import type { createProductInfoRoutes } from './product-info/routes.js'
import type { createWithdrawalRoutes } from './withdrawal/routes.js'
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
  // 내 이름(운영진 이름) 읽기와 고치기
  profile?: ReturnType<typeof createProfileRoutes>
  // 탈퇴: 로그인한 사람 자신의 계정을 지운다(/api/me/withdrawal)
  withdrawal?: ReturnType<typeof createWithdrawalRoutes>
  // 업무: 목록, 하나 읽기
  tasks?: ReturnType<typeof createTaskRoutes>
  // 홈: 그 사람의 부분을 한 번에 읽기
  home?: ReturnType<typeof createHomeRoutes>
  // 구매 요청: 목록, 하나 읽기, 내기, 취소, 결재
  purchases?: ReturnType<typeof createPurchaseRoutes>
  // 회계 기간과 지출 예산 항목
  budget?: ReturnType<typeof createBudgetRoutes>
  // 지출: 목록, 하나 읽기, 적기, 취소, 환급
  expenses?: ReturnType<typeof createExpenseRoutes>
  // 수입: 기간의 목록, 하나 읽기, 적기, 취소
  incomes?: ReturnType<typeof createIncomeRoutes>
  // 회계 기간 목록과 결산서 읽기
  closing?: ReturnType<typeof createClosingRoutes>
  // 결산서 엑셀(공개용·감사용)과 증빙 묶음
  closingExport?: ReturnType<typeof createClosingExportRoutes>
  // 가입 동의: 지금 판 읽기, 동의하기, 그리고 동의 전 막기(/api/organizations/ 아래 모든 경로에 접두어로 건다). 둘이 한 쌍이라 따로 연결하지 못한다.
  agreement?: ReturnType<typeof createAgreement>
  // 행사: 목록, 하나 읽기, 만들기, 고치기, 책임자
  events?: ReturnType<typeof createEventRoutes>
  // 계좌: 목록, 만들기, 고치기, 닫기
  accounts?: ReturnType<typeof createAccountRoutes>
  // 신청 양식: 목록, 하나 읽기, 만들기, 고치기, 멈추기와 다시 받기
  registrations?: ReturnType<typeof createRegistrationRoutes>
  // 입금 확인, 확인 취소, 환불함
  deposits?: ReturnType<typeof createDepositRoutes>
  // 행사 정산 읽기
  settlement?: ReturnType<typeof createSettlementRoutes>
  // 학생회비 납부자 명단: 보기, 올리기, 빼기
  feePayments?: ReturnType<typeof createFeePaymentRoutes>
  // 쿠팡 상품 정보 불러오기(ReefAPI). 키가 없으면 경로는 있고 불러오기만 꺼진다.
  productInfo?: ReturnType<typeof createProductInfoRoutes>
  // 로그인 없이 쓰는 공개 경로(/api/public/): 양식 읽기
  publicRegistrations?: ReturnType<typeof createPublicRegistrationRoutes>
}

export function createApp({
  auth,
  trustedOrigin,
  agreement,
  publicRegistrations,
  ...modules
}: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // 가드 다음, 각 경로 앞이다. 형식이 틀린 요청은 가드가 먼저 거절한다.
  if (agreement) app.use('/api/organizations/*', agreement.gate)
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
  // 로그인 없이 쓰는 공개 경로(참가 신청)도 같은 화면에서만 보내므로 같은 가드를 건다.
  app.use('/api/public/*', mutationGuard(trustedOrigin))
  app.get('/api/health', c => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', c => auth.handler(c.req.raw))
  // 모듈은 createApp을 부르는 쪽이 넘긴 객체의 키 차례로 붙는다(app-modules.ts의 차례. AppOptions 타입에 적힌 차례가 아니다). 경로가 겹치지 않으므로 차례는 결과에 영향이 없다. 가입 동의(gate와 routes가 한 쌍)와 공개 경로(환경 타입이 다르다)만 따로 붙인다.
  for (const routes of [agreement?.routes, ...Object.values(modules)])
    if (routes) app.route('/api', routes)
  // 공개 경로는 로그인 세션을 쓰지 않아 환경 타입이 다르다.
  if (publicRegistrations) app.route('/api', publicRegistrations)
  app.onError(handleError)
  return app
}
