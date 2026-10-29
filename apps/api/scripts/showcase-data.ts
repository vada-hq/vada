import { and, eq } from 'drizzle-orm'
import { council } from '../src/db/schema.js'
import type { Db } from '../src/db/types.js'
import type { AccountRole } from '../src/flows/showcase/content/types.js'
import { SHOWCASE } from '../src/flows/showcase/content/index.js'
import { runShowcase, showcaseStart } from '../src/flows/showcase/run.js'
import { startFlow } from '../src/flows/server.js'
import type { FileStorage } from '../src/storage/storage.js'
import { uploadDemoEvidence } from './demo-evidence.js'
import { requireGoogleUser } from './test-data.js'

// 시연 학생회 한 벌(flows/showcase/content)을 실제 경로로 만든다. 같은 학교의 같은 학생회 이름이 있으면 아무것도 하지 않는다.
// 같은 학교의 다른 이름은 된다(연습용과 본 시연용을 따로 둔다).

export type ShowcaseNames = { schoolName: string; name: string }
export type ShowcaseResult = 'created' | 'exists'
export type ShowcaseDeps = { storage: FileStorage; fetcher?: typeof fetch }

// 한 거래다. 시나리오의 요청은 이 거래의 저장점으로 이어지므로 중간에 하나라도 실패하면 학생회도 가상 계정도 남지 않는다
// (올린 증빙 파일만 저장소에 남을 수 있다). now는 마지막 단계의 시각(돌리는 때)이다.
export async function seedShowcase(
  db: Db,
  {
    names,
    accounts,
    now,
  }: { names: ShowcaseNames; accounts: Partial<Record<AccountRole, string>>; now: Date },
  { storage, fetcher = fetch }: ShowcaseDeps,
): Promise<ShowcaseResult> {
  return db.transaction(async tx => {
    for (const userId of Object.values(accounts)) await requireGoogleUser(tx, userId)
    const [existing] = await tx
      .select({ id: council.id })
      .from(council)
      .where(and(eq(council.schoolName, names.schoolName), eq(council.name, names.name)))
      .limit(1)
    if (existing) return 'exists'
    const flow = await startFlow(tx, {
      start: showcaseStart(SHOWCASE, now),
      scope: 'transaction',
      storage,
    })
    await runShowcase(flow, {
      content: SHOWCASE,
      council: names,
      finalAt: now,
      accounts,
      uploadEvidence: key => uploadDemoEvidence(storage, key, fetcher),
    })
    return 'created'
  })
}
