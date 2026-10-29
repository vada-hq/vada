import { eq } from 'drizzle-orm'
import { council, users } from '../src/db/schema.js'
import type { Db } from '../src/db/types.js'
import { EVENT_B, EVENT_C, rehearsalStart, runRehearsal } from '../src/flows/rehearsal.js'
import { startFlow } from '../src/flows/server.js'
import type { FileStorage } from '../src/storage/storage.js'
import { uploadDemoEvidence } from './demo-evidence.js'
import { requireGoogleUser } from './test-data.js'
import { DEMO_SCHOOL_NAME } from '../src/home/demo-budget.js'

// 섭외와 리허설에서 보이는 시연 학생회. 학교 이름으로 찾고, 있으면 아무것도 하지 않는다(다시 넣으려면 그 학교 이름을 바꾼다).
// 시험 학생회(VADA 시험 학교)와 이름이 달라 서로 찾지 않는다. 내용은 리허설 시나리오(flows/rehearsal.ts)를 그대로 돈 결과다.
// 이름은 부장 홈의 시연용 고정값도 쓰므로 서버 쪽(home/demo-budget.ts)에 둔다.

export type DemoResult = 'created' | 'exists'
export type DemoDeps = { storage: FileStorage; fetcher?: typeof fetch }

// 한 거래다. 시나리오의 요청은 이 거래의 저장점으로 이어지므로 중간에 하나라도 실패하면 학생회도 계정도 남지 않는다.
// now는 마지막 단계의 시각(돌리는 때)이다.
export async function seedDemoCouncil(
  db: Db,
  userId: string,
  now: Date,
  { storage, fetcher = fetch }: DemoDeps,
): Promise<DemoResult> {
  return db.transaction(async tx => {
    await requireGoogleUser(tx, userId)
    const [existing] = await tx
      .select({ id: council.id })
      .from(council)
      .where(eq(council.schoolName, DEMO_SCHOOL_NAME))
      .limit(1)
    if (existing) return 'exists'
    const flow = await startFlow(tx, { start: rehearsalStart(now), scope: 'transaction', storage })
    // 회장은 명령에 준 실제 계정이다. 이 흐름의 세션에 들이기만 하고 계정은 만들지 않는다.
    flow.flowSession.admit(userId)
    // 운영진 목록에서 이름으로 찾으므로 회장의 이름은 계정의 이름이다.
    const [account] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId))
    const chief = { userId, name: account!.name, api: flow.driver.as(userId) }
    const options = {
      chief,
      finalAt: now,
      uploadEvidence: (key: string) => uploadDemoEvidence(storage, key, fetcher),
      council: { name: 'VADA 시연 학생회', schoolName: DEMO_SCHOOL_NAME },
    }
    // A·B는 흐름의 링크 활성화를 거쳐 신청을 받는다. A는 끝까지, B는 구매 요청까지, C는 행사 만들기만 한다.
    const { state } = await runRehearsal(flow, options)
    await runRehearsal(flow, {
      ...options,
      event: EVENT_B,
      stopAfter: 'request',
      omit: ['deposit'],
      resume: state,
    })
    await runRehearsal(flow, { ...options, event: EVENT_C, stopAfter: 'event', resume: state })
    return 'created'
  })
}
