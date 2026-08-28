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

const test = run('npm', ['run', 'e2e'], { env: { ...process.env, E2E_PREVIEW: '1' } })
process.exit(test.status ?? 1)
