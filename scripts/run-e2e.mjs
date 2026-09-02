import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { onlyNetworkBroke } from './test-output.mjs'

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

/**
 * 흘려보내면서 **동시에 담아 둔다.**
 *
 * 담기만 하면 5분 동안 아무것도 안 보이고, 흘리기만 하면 무엇이 왜 죽었는지 뒤에서
 * 읽을 수 없다. 둘 다 필요해서 `spawnSync`를 버렸다 — 실패했다고 한 번 더 돌려
 * 출력을 얻는 것은 5분을 두 번 쓰는 일이다.
 */
function runCapturing(command, args, options = {}) {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd: app, shell: true, ...options })
    let output = ''
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk) => {
        const text = chunk.toString()
        output += text
        process.stdout.write(text)
      })
    }
    child.on('close', (code) => done({ status: code ?? 1, output }))
  })
}

// **검사용 빌드는 다른 자리에 둔다.**
//
// 이 빌드는 서버에 붙지 않는다(`VITE_FIXTURES`). 같은 `dist/`에 쓰면 검사를 돌린
// 다음 손으로 배포하는 사람이 **개발용 응답을 물고 있는 묶음을 실서비스에 올린다** —
// 화면은 멀쩡히 그려지므로 아무도 모른다. 자리를 갈라 그 일이 못 생기게 한다.
const build = run('npm', ['run', 'build', '--', '--outDir', 'dist-e2e'], {
  env: { ...process.env, VITE_FIXTURES: '1' },
})
if (build.status !== 0) process.exit(build.status ?? 1)

// **서버에 대고 화면을 그리는 검사는 여기서 돈다.**
//
// 진짜 Postgres를 띄우므로 빠른 게이트의 시간 예산을 먹는데, 성질을 보면 그것은
// 단위 검사가 아니라 통합이다. 지우는 것이 아니라 옮긴 것이라 재는 것은 그대로다.
//
// **파일 이름이 아니라 이름 조각으로 집는다**(`vitest run server.test`). 한동안
// 파일 하나를 이름으로 박아 두었는데, 그러면 새로 쓴 서버 검사는 초록도 붉음도
// 아닌 채로 아무 데서도 안 돈다 — 그것이 가장 조용한 실패다.
const server = run('npm', ['run', 'test:server'])
if (server.status !== 0) process.exit(server.status ?? 1)

// **연결이 끊긴 것은 검사의 판정이 아니다.**
//
// 2026-08-31에 `net::ERR_NETWORK_CHANGED`로 하나가 죽어 초록 코드의 푸시가 막혔다 —
// 427개는 통과했고 그 하나는 단언이 틀린 게 아니라 **페이지를 열지 못한** 것이다.
// 검사가 실패한 것과 검사를 돌리지 못한 것은 다른 일이라는, `run-tests.mjs`가
// 이미 쓰는 규칙을 여기에도 둔다.
//
// **좁게 본다.** 브라우저가 그물을 못 탄 것만 고르고 나머지는 그대로 실패다 —
// 넓히면 진짜 실패가 흔들림으로 읽힌다. 그리고 한 번만 다시 돌린다: 그물이 정말
// 끊겨 있으면 두 번째도 같은 자리에서 죽으므로 걸러지지 않는다.
const e2e = { env: { ...process.env, E2E_PREVIEW: '1' } }
let test = await runCapturing('npm', ['run', 'e2e'], e2e)
if (test.status !== 0 && onlyNetworkBroke(test.output)) {
  process.stdout.write(
    '\n[run-e2e] 그물이 끊겨 실패했습니다(검사의 판정이 아닙니다). 한 번 더 돌립니다.\n',
  )
  test = await runCapturing('npm', ['run', 'e2e'], e2e)
}
const status = test.status

// **판정을 글로도 낸다.** 종료 코드만으로 말하면 `| tail`에 물린 순간 그것이
// 사라지고, 붉은 검사가 초록으로 읽힌다 — 그렇게 MSG-02가 하루를 붉은 채로 지났다.
// 코드는 가려져도 마지막 줄은 남는다.
process.stdout.write(
  status === 0 ? '\n[run-e2e] 통과했습니다.\n' : `\n[run-e2e] **실패했습니다**(코드 ${status}).\n`,
)
process.exit(status)
