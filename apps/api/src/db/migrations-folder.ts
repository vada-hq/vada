import { fileURLToPath } from 'node:url'

// 마이그레이션 SQL이 있는 폴더. 적용 도구(migrate.ts, pg-smoke)와 시험 DB(test-db.ts)가 같은 폴더를 가리키도록 위치를 정하는 곳은 여기 하나다.
export const migrationsFolder = fileURLToPath(new URL('../../migrations', import.meta.url))
