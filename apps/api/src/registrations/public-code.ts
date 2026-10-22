import { eq } from 'drizzle-orm'
import { registrationForm } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { newInviteCode } from '../invites/code.js'

const MAX_ATTEMPTS = 5
// 아직 쓰이지 않은 공개 코드. 포스터와 QR에 찍히므로 만들 때 정하고 바꾸지 않는다. 겹칠 확률은 32^8분의 1이라 몇 번만 다시 뽑는다.
// 같은 코드를 동시에 정하는 일은 DB의 유일 제약이 막는다(양식 만들기는 학생회 행 잠금으로 한 번에 하나지만, 다른 학생회와는 겹칠 수 있다).
export async function freshPublicCode(db: Pick<Db, 'select'>): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = newInviteCode()
    const [taken] = await db
      .select({ id: registrationForm.id })
      .from(registrationForm)
      .where(eq(registrationForm.publicCode, code))
    if (!taken) return code
  }
  throw new Error('Public code collision')
}
