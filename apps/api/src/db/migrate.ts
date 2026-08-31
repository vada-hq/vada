import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './client.ts'

// 실서비스의 표를 **옮김 파일로** 만든다.
//
// 검사는 표를 통째로 지우고 다시 만들지만 실서비스는 그럴 수 없다 — 이미 든 것이
// 있기 때문이다. 그래서 여기서는 아직 적용하지 않은 것만 차례로 적용한다.
//
// **검사와 같은 파일을 읽는다.** 검사가 쓰는 `schema-sql.ts`도 `migrations/`에서
// 나오므로, 두 길이 갈릴 자리가 없다.
//
// 켤 때마다 부르지 않는다. 배포가 이것을 한 번 부르고 그다음 서버가 선다 —
// 여러 대가 함께 켜지면서 저마다 표를 고치면 서로를 밟는다.

const url = process.env.DATABASE_URL
if (url === undefined || url.trim() === '') {
  throw new Error('DATABASE_URL이 없습니다. 어느 저장소에 적용할지 모른 채로 돌지 않습니다.')
}

const here = dirname(fileURLToPath(import.meta.url))
const db = connect(url)
await migrate(db, { migrationsFolder: join(here, '..', '..', 'migrations') })
process.stdout.write('표를 최신으로 맞췄습니다.\n')
// 옮기는 일은 끝났다. 열어 둔 연결을 닫지 않으면 이 프로세스가 안 끝나고,
// 배포는 그것을 '아직 안 끝났다'로 읽고 기다린다.
process.exit(0)
