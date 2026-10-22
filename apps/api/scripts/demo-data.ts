import { eq } from 'drizzle-orm'
import { koreanYearOf } from '@vada/contracts'
import { actorOf } from '../src/access/actor.js'
import { lockCouncil } from '../src/access/authorize.js'
import { createCouncil } from '../src/councils/service.js'
import { council } from '../src/db/schema.js'
import type { Db } from '../src/db/types.js'
import { requireGoogleUser } from './test-data.js'
import { addMoney } from './demo-money.js'
import { createCast } from './demo-people.js'
import { addWork } from './demo-work.js'

// 섭외와 리허설에서 보이는 시연 학생회. 학교 이름으로 찾고, 있으면 아무것도 하지 않는다(다시 넣으려면 그 학교 이름을 바꾼다).
// 시험 학생회(VADA 시험 학교)와 이름이 달라 서로 찾지 않는다. 날짜는 now(돌리는 날)를 기준으로 한다.
export const DEMO_SCHOOL_NAME = 'VADA 시연 학교'

export type DemoResult = 'created' | 'exists'

// 한 거래다. 중간에 하나라도 실패하면 아무것도 남지 않는다.
export async function seedDemoCouncil(db: Db, userId: string, now: Date): Promise<DemoResult> {
  return db.transaction(async tx => {
    await requireGoogleUser(tx, userId)
    const [existing] = await tx
      .select({ id: council.id })
      .from(council)
      .where(eq(council.schoolName, DEMO_SCHOOL_NAME))
      .limit(1)
    if (existing) return 'exists'
    const year = koreanYearOf(now)
    const councilId = await createCouncil(
      tx,
      userId,
      {
        name: 'VADA 시연 학생회',
        unit: 'department',
        schoolName: DEMO_SCHOOL_NAME,
        cohortName: year,
        startsOn: `${year}-01-01`,
        endsOn: `${year}-12-31`,
      },
      now,
    )
    // 방과 편성을 바꾸는 서비스 함수는 학생회 행을 잠근 거래 안에서 부르는 것이 전제다.
    await lockCouncil(tx, councilId)
    const president = await actorOf(tx, userId, councilId, now)
    if (!president) throw new Error('Demo council has no current cohort')
    const cast = await createCast(tx, president, now)
    await addMoney(tx, cast, now)
    await addWork(tx, cast, now)
    return 'created'
  })
}
