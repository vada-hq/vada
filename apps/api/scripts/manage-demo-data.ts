import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createR2Storage, r2ConfigFrom } from '../src/expenses/storage.js'
import { DEMO_ORGANIZATION_ID, demoCalendar, resetDemo, seedDemo } from './demo-data.js'

// 배포 DB(m1-preview)에 기획자 시연 데이터를 넣는다. 기본은 점검(지울 행 수)만 하고, --apply일 때만 지우고 넣는다.
// 접속 주소, 키, 개인 값, 오류 원문은 출력하지 않는다.
async function main() {
  const args = process.argv.slice(2)
  if (args[0] !== 'preview' || args.length > 2 || (args[1] !== undefined && args[1] !== '--apply')) {
    console.error('사용법: preview [--apply]')
    process.exitCode = 1
    return
  }
  const apply = args[1] === '--apply'
  const env = parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8'))
  const url = env.M1_PREVIEW_DATABASE_URL?.trim()
  const r2 = r2ConfigFrom(env as NodeJS.ProcessEnv)
  if (!url || !r2) throw new Error('Missing configuration')
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  demoCalendar(today)
  const client = postgres(url, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 20, onnotice: () => {} })
  try {
    const counts = await client`SELECT
      (SELECT count(*)::int FROM events WHERE organization_id = ${DEMO_ORGANIZATION_ID}) AS events,
      (SELECT count(*)::int FROM expenses WHERE organization_id = ${DEMO_ORGANIZATION_ID}) AS expenses,
      (SELECT count(*)::int FROM expense_receipts WHERE organization_id = ${DEMO_ORGANIZATION_ID}) AS receipts,
      (SELECT count(*)::int FROM budget_periods WHERE organization_id = ${DEMO_ORGANIZATION_ID}) AS periods,
      (SELECT count(*)::int FROM registrations WHERE organization_id = ${DEMO_ORGANIZATION_ID}) AS registrations,
      (SELECT count(*)::int FROM memberships WHERE organization_id = ${DEMO_ORGANIZATION_ID} AND user_id NOT LIKE 'demo-member-%') AS logins`
    console.log(`지울 내용: ${JSON.stringify(counts[0])} (로그인 계정의 소속은 남긴다)`)
    if (!apply) return
    const db = drizzle(client)
    const storage = createR2Storage(r2)
    const keys = await resetDemo(db)
    for (const key of keys) await storage.remove(key)
    console.log(`지움: 영수증 파일 ${keys.length}개`)
    await seedDemo({ db, storage, today, log: line => console.log(`- ${line}`),
      upload: async (target, headers, body) => {
        const response = await fetch(target, { method: 'PUT', headers, body: new Blob([body as Uint8Array<ArrayBuffer>]) })
        if (!response.ok) throw new Error(`UPLOAD_FAILED ${response.status}`)
      } })
    console.log('시연 데이터 준비 완료')
  } finally { await client.end({ timeout: 5 }) }
}

main().catch((error: unknown) => {
  // 단계 이름과 상태·오류 코드만 남긴다(DEMO_STEP, DEMO_WINDOW 등).
  const message = error instanceof Error && /^(DEMO_|UPLOAD_FAILED|Missing configuration)/.test(error.message) ? error.message : ''
  console.error(`처리 실패. ${message}`)
  process.exitCode = 1
})
