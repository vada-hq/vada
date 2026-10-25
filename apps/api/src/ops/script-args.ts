import { targetSourceOf } from './migrate/migrate-check.js'

// 맨 앞의 `--` 하나를 뺀다. pnpm은 스크립트 이름 뒤의 인자를 그대로 넘겨서, npm 때처럼 `db:migrate -- --apply`라고 치면 `--`까지 온다.
export const withoutSeparator = (args: readonly string[]) =>
  args[0] === '--' ? args.slice(1) : [...args]

// 실제 DB에 닿는 운영 명령(demo, privacy)이 같이 쓰는 대상 고르기. 규칙은 db:migrate와 같다(AGENTS.md '마이그레이션').
// npm이 --dry-run을 자기 옵션으로 삼키면(플래그 앞의 --를 빠뜨리면) 환경 변수로 드러난다. 그것도 멈춘다. npm은 --dry-run=false를 빈 값으로 넘긴다.
export const NPM_SWALLOWED_DRY_RUN =
  'npm이 --dry-run을 자기 옵션으로 받았다. 플래그 앞에 --를 붙인다. 아무것도 하지 않았다.'
export const npmSwallowedDryRun = (env: { readonly npm_config_dry_run?: string | undefined }) =>
  Boolean(env.npm_config_dry_run && env.npm_config_dry_run !== 'false')

const SHELL_URL_WITHOUT_FLAG =
  '셸에 DATABASE_URL이 있다. 그 DB를 쓰려면 --from-shell을 붙이고, .env의 DB를 쓰려면 셸의 DATABASE_URL을 지운다. 아무것도 하지 않았다.'
const FLAG_WITHOUT_SHELL_URL =
  '--from-shell을 줬지만 셸에 DATABASE_URL이 없다. 아무것도 하지 않았다.'
const NO_URL = '.env에 DATABASE_URL이 없다. 아무것도 하지 않았다.'

// 대상 주소. 기본은 .env이고 셸의 DATABASE_URL은 --from-shell일 때만 쓴다. .env가 없거나 읽을 수 없으면 주소가 없는 것과 같다(오류 원문은 보이지 않는다).
export function databaseUrlOf(
  fromShell: boolean,
  shellUrl: string | undefined,
  readEnvUrl: () => string | undefined,
): { url: string; source: '셸' | '.env' } | { stop: string } {
  const source = targetSourceOf(fromShell, shellUrl)
  if ('stop' in source)
    return {
      stop:
        source.stop === 'SHELL_URL_WITHOUT_FLAG' ? SHELL_URL_WITHOUT_FLAG : FLAG_WITHOUT_SHELL_URL,
    }
  if (source.source === 'shell') return { url: source.url, source: '셸' }
  let url: string | undefined
  try {
    url = readEnvUrl()?.trim()
  } catch {
    url = undefined
  }
  return url ? { url, source: '.env' } : { stop: NO_URL }
}
