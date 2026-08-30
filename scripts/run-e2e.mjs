import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// e2e는 **내보낼 묶음**을 친다. 개발 서버는 화면을 열 때마다 모듈 2,700개를 따로
// 내주고, 검사는 화면을 176번 여는 일이라 그 값이 통째로 곱해진다. 재 보니
// 4.9분 → 1.4분이었다.
//
// 그래서 여기서 **먼저 빌드한다.** 빌드를 부르는 쪽에 맡기면 언젠가 낡은 묶음을
// 치고 초록불이 뜬다 — 고친 것을 검사하지 않고 통과하는 것이 가장 나쁜 실패다.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const app = resolve(root, 'apps/vada-web')

const run = (command, args, options = {}) =>
  spawnSync(command, args, { cwd: app, stdio: 'inherit', shell: true, ...options })

const build = run('npm', ['run', 'build'])
if (build.status !== 0) process.exit(build.status ?? 1)

// **서버에 대고 화면을 그리는 검사는 여기서 돈다.**
//
// 진짜 Postgres를 띄우므로 빠른 게이트의 시간 예산을 먹는데, 성질을 보면 그것은
// 단위 검사가 아니라 통합이다. 지우는 것이 아니라 옮긴 것이라 재는 것은 그대로다.
const server = run('npm', ['run', 'test:server'])
if (server.status !== 0) process.exit(server.status ?? 1)

const test = run('npm', ['run', 'e2e'], { env: { ...process.env, E2E_PREVIEW: '1' } })
const status = test.status ?? 1

// **판정을 글로도 낸다.** 종료 코드만으로 말하면 `| tail`에 물린 순간 그것이
// 사라지고, 붉은 검사가 초록으로 읽힌다 — 그렇게 MSG-02가 하루를 붉은 채로 지났다.
// 코드는 가려져도 마지막 줄은 남는다.
process.stdout.write(
  status === 0 ? '\n[run-e2e] 통과했습니다.\n' : `\n[run-e2e] **실패했습니다**(코드 ${status}).\n`,
)
process.exit(status)
