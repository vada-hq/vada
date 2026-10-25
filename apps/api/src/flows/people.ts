import { accounts, users } from '../db/schema.js'
import type { Db } from '../db/types.js'
import type { FlowCaller } from './driver.js'
import type { Flow } from './server.js'

// 흐름의 인물. 로그인 수단이 없는 계정이라(이메일 @demo.vada.invalid, Google 연결 없음) 실제 사람이 그 자리로 로그인할 수 없다(PRIN-5).
const DEMO_EMAIL_DOMAIN = 'demo.vada.invalid'

// flows/가 db/schema의 표에 직접 쓰는 유일한 곳이다(flow-leak.test.ts가 지킨다). 소속·직급은 이 뒤에 실제 경로로만 만든다.
// googleLinked는 흐름 시험의 계정에만 준다: 시험 계정은 같은 꼴에 Google 연결(accounts 행)만 더한다.
export async function createAccount(
  db: Db,
  { userId, name, googleLinked }: { userId: string; name: string; googleLinked: boolean },
) {
  await db.insert(users).values({
    id: userId,
    name,
    email: `${userId}@${DEMO_EMAIL_DOMAIN}`,
    emailVerified: true,
  })
  if (googleLinked)
    await db.insert(accounts).values({
      id: `${userId}-google`,
      userId,
      accountId: `${userId}-google`,
      providerId: 'google',
    })
}

export type Person = { userId: string; name: string; api: FlowCaller }

// 계정을 만들고 이 흐름의 세션에 들인다. 들어오기는 enterCouncil이 실제 초대 경로로 한다.
export async function createPerson(
  flow: Pick<Flow, 'db' | 'flowSession' | 'driver'>,
  key: string,
  name: string,
  { googleLinked = false } = {},
): Promise<Person> {
  const userId = `flow-${key}`
  await createAccount(flow.db, { userId, name, googleLinked })
  flow.flowSession.admit(userId)
  return { userId, name, api: flow.driver.as(userId) }
}

async function expectOk(response: Response, step: string) {
  if (!response.ok) throw new Error(`${step}: ${response.status} ${await response.text()}`)
  return response
}

// 초대 경로로 들어와 동의 경로를 지난다: 초대 코드로 들어오고, 약관 판을 읽어 그대로 동의한다.
export async function enterCouncil(person: Person, code: string) {
  const terms = (await (
    await expectOk(await person.api.get('/api/me/agreement'), '동의 읽기')
  ).json()) as {
    termsVersion: string
    privacyVersion: string
  }
  await expectOk(await person.api.post('/api/organizations/join', { code }), '초대로 들어오기')
  await expectOk(
    await person.api.post('/api/me/agreement', {
      termsVersion: terms.termsVersion,
      privacyVersion: terms.privacyVersion,
    }),
    '동의하기',
  )
}
