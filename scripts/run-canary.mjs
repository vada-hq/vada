import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 카나리를 한 줄로 돈다. 까닭은 `apps/api/scripts/ship-canary.ts`에 있다.
//
// 세 걸음이고 **차례가 뜻을 갖는다.**
//
// 1. 나가는 묶음을 짓는다(`npm run build`) — 이 안에 개발용 응답이 실렸는지 재는
//    검사가 들어 있다. 여기서 막히면 뒤는 볼 것도 없다.
// 2. 기대값을 훑어서 만든다 — 손으로 고르면 고르는 사람이 안 보는 화면은 목록도
//    안 본다.
// 3. 그 묶음을 진짜 저장소에 붙여 놓고 브라우저로 걷는다.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'apps', 'vada-web')

function run(command, args, options = {}) {
  const done = spawnSync(command, args, { stdio: 'inherit', shell: true, cwd: ROOT, ...options })
  if (done.status !== 0) process.exit(done.status ?? 1)
}

run('npm', ['run', 'build'])
run('node', [join(ROOT, 'scripts', 'canary-expect.mjs')])
run('npx', ['playwright', 'test', '-c', 'playwright.canary.config.ts'], { cwd: WEB })

console.log('[카나리] 통과했습니다.')
