import { createAgreement } from './agreement/routes.js'
import { createAccountRoutes } from './accounts/routes.js'
import { createBudgetRoutes } from './budget/routes.js'
import { createChatPush } from './chat/notify.js'
import { createChatRoutes } from './chat/routes.js'
import { createClosingExportRoutes } from './closing/export-routes.js'
import { createClosingRoutes } from './closing/routes.js'
import { createCouncilRoutes } from './councils/routes.js'
import { createDepositRoutes } from './deposits/routes.js'
import { createEventRoutes } from './events/routes.js'
import { createExpenseRoutes } from './expenses/routes.js'
import { createFeePaymentRoutes } from './fee-payments/routes.js'
import { createHomeRoutes } from './home/routes.js'
import { createIncomeRoutes } from './incomes/routes.js'
import { createInviteRoutes } from './invites/routes.js'
import { createPurchasePush } from './purchases/notify.js'
import { createPurchaseRoutes } from './purchases/routes.js'
import { createPushDeviceRoutes, forgetPushDevice } from './push/devices.js'
import { createPushRoutes } from './push/routes.js'
import { createProfileRoutes } from './profile/routes.js'
import { createPublicRegistrationRoutes } from './registrations/public-routes.js'
import { createRegistrationRoutes } from './registrations/routes.js'
import { createSettlementRoutes } from './settlement/routes.js'
import { createTaskPush, type AfterTimer } from './tasks/notify.js'
import { createTaskRoutes } from './tasks/routes.js'
import { createTeamRoutes } from './team/routes.js'
import type { AppOptions } from './app.js'
import type { SessionReader } from './auth/require-session.js'
import type { Db } from './db/types.js'
import type { RateLimiter } from './http/rate-limit.js'
import type { PushSender } from './push/sender.js'
import type { FileStorage } from './storage/storage.js'

export type AppDeps = {
  // 모든 라우트 모듈이 이 시계 하나를 쓴다. 모듈이 자기 시계를 만들면 시계를 미뤄도 그 모듈만 지금 시각으로 판단한다.
  clock: () => Date
  // 요청 내기, 지출 적기, 수입 적기가 한도 하나를 같이 쓰도록 같은 인스턴스를 셋에 준다.
  writeLimiter: RateLimiter
  // 같은 명령의 재전송 영수증에 쓰는 비밀 값(HMAC 키)
  receiptKey: string
  // 없으면 사진과 결산 묶음만 막힌다.
  storage?: FileStorage | undefined
  // 없으면 알림 경로와 대화·업무·구매 알림을 만들지 않는다(그 일들은 알림 없이 돈다).
  push?:
    | {
        publicKey: string
        send: PushSender
        wait?: (ms: number) => Promise<void>
        // 배정 알림을 모으는 타이머. 운영은 realTimer, 시험은 가짜를 넣는다.
        after: AfterTimer
      }
    | undefined
}

function pushModules(db: Db, session: SessionReader, deps: AppDeps) {
  const { push, clock } = deps
  if (!push) return { routes: undefined }
  return {
    routes: createPushRoutes(session, {
      publicKey: push.publicKey,
      send: push.send,
      ...(push.wait ? { wait: push.wait } : {}),
      forget: (userId, endpoint) => forgetPushDevice(db, userId, endpoint),
      clock,
    }),
    chat: createChatPush(db, push.send),
    task: createTaskPush(db, push.send, push.after),
    purchase: createPurchasePush(db, push.send),
  }
}

// 라우트 모듈 연결의 한 곳. 운영 서버, 경계 시험, 흐름 서버가 모두 이것으로 앱을 만든다.
// 반환 타입이 AppOptions의 모든 모듈을 요구하므로 AppOptions에 모듈을 더하고 여기 연결하지 않으면 타입 오류다.
// 가입 동의, 휴대폰 기기 저장, 내 이름은 시각을 쓰지 않아 시계를 받지 않는다.
export function appModulesOf(db: Db, session: SessionReader, deps: AppDeps) {
  const { clock, writeLimiter, receiptKey, storage } = deps
  const push = pushModules(db, session, deps)
  return {
    councils: createCouncilRoutes(db, session, clock),
    invites: createInviteRoutes(db, session, clock),
    team: createTeamRoutes(db, session, clock),
    chat: createChatRoutes(db, session, { clock, push: push.chat, storage }),
    push: push.routes,
    pushDevices: createPushDeviceRoutes(db, session),
    profile: createProfileRoutes(db, session),
    tasks: createTaskRoutes(db, session, { clock, push: push.task }),
    home: createHomeRoutes(db, session, { clock }),
    purchases: createPurchaseRoutes(db, session, { clock, push: push.purchase, writeLimiter }),
    budget: createBudgetRoutes(db, session, { clock }),
    expenses: createExpenseRoutes(db, session, { clock, writeLimiter, storage, receiptKey }),
    incomes: createIncomeRoutes(db, session, { clock, writeLimiter }),
    closing: createClosingRoutes(db, session, { clock, bundleAvailable: storage !== undefined }),
    closingExport: createClosingExportRoutes(db, session, { clock, storage }),
    agreement: createAgreement(db, session),
    events: createEventRoutes(db, session, { clock }),
    accounts: createAccountRoutes(db, session, { clock }),
    registrations: createRegistrationRoutes(db, session, { clock }),
    deposits: createDepositRoutes(db, session, { clock }),
    settlement: createSettlementRoutes(db, session, { clock }),
    feePayments: createFeePaymentRoutes(db, session, { clock }),
    publicRegistrations: createPublicRegistrationRoutes(db, { clock, receiptKey }),
  } satisfies Required<Omit<AppOptions, 'auth' | 'trustedOrigin'>>
}
