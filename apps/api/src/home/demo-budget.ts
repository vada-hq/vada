import { eq } from 'drizzle-orm'
import type { HomeDepartmentBudget } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { council } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 섭외와 리허설에서 보이는 시연 학생회의 학교 이름(scripts/demo-data.ts가 이 이름으로 만들고 찾는다).
export const DEMO_SCHOOL_NAME = 'VADA 시연 학교'

// 시연용 임시: 시연 뒤 budget_item 담당 부서로 바꿈(대표 10/30, notes dept-home-content.md '우리 부서가 맡은 예산').
// 그때까지 부장 홈의 이 한 줄만 고정값이고, 실제 학생회에는 오지 않는다.
const DEMO_PRIZE = 600_000
const DEMO_DEPARTMENT_BUDGET: HomeDepartmentBudget = {
  name: '가을 축제 상금',
  amount: DEMO_PRIZE,
  remaining: DEMO_PRIZE,
}

export async function departmentBudgetOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
): Promise<HomeDepartmentBudget | null> {
  const [row] = await db
    .select({ schoolName: council.schoolName })
    .from(council)
    .where(eq(council.id, actor.councilId))
  return row?.schoolName === DEMO_SCHOOL_NAME ? DEMO_DEPARTMENT_BUDGET : null
}
