import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// **나가는 묶음을 사람이 여는 그대로 연다.**
//
// 브라우저 검사 428개는 `VITE_FIXTURES=1`로 만든 `dist-e2e/`를 본다. 그것은 명세가
// 말한 것을 화면이 그리는가를 재는 자리이고 개발용 응답이 곧 그 명세의 예시 값이라
// 옳은 짝이다. 그런데 **실제로 배포되는 `dist/`는 아무도 브라우저로 안 열어 본다.**
//
// 2026-09-05에 값을 치렀다. 방금 만든 빈 학생회의 홈에 남의 행사와 남의 예산이
// 그려졌는데, 검사 428개 중 하나도 그것을 못 잡았다 — **사람이 눌러 보고 찾았다.**
// 재는 자리가 없었기 때문이다.
//
// 여기가 그 자리다. 재는 것은 **출하 조합**이다:
//
//   나가는 묶음(dist) + 진짜 Postgres + 학생회 둘 + 한 사람의 신원
//
// ## 무엇을 아직 안 재는가 (정직하게)
//
// 로그인은 **고정된 신원으로 대신한다.** 구글을 다녀오는 길과 쿠키는 `serve.ts`가
// 붙이는 것이고 여기서는 그 자리에 사람을 하나 놓는다. 그래서 이 카나리는
// **OAuth·Worker·Render·Neon을 지나지 않는다** — 그것을 재려면 배포된 주소에
// 전용 학생회로 도는 연기 검사가 따로 있어야 한다. 아직 없다.
//
// 실행은 `node --experimental-strip-types`가 필요하다(api가 TypeScript다).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = process.env.CANARY_PORT ?? '4180'

const child = spawn(
  process.execPath,
  ['--experimental-strip-types', '--no-warnings', join(ROOT, 'apps', 'api', 'scripts', 'ship-canary.ts')],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CANARY_PORT: PORT } },
)

child.on('exit', (code) => process.exit(code ?? 1))
