// **배포된 것을 두드려 본다.**
//
// 여기까지 눈금이 재는 것은 전부 **이 기계 안**이다. 카나리조차 로컬 PGlite에
// 나가는 묶음을 붙여 놓고 본다. 그런데 사람이 실제로 여는 것은 Worker와 Render와
// Neon과 구글이 사슬로 이어진 것이고, **그 사슬을 아무도 안 재고 있었다** — 오늘까지
// 그 자리에서 난 일은 전부 사람이 눈으로 찾았다(2026-09-02 건강 확인 주소, 09-05
// 남의 학생회가 보인 홈, 09-06 로딩과 박힌 '4건').
//
// 그래서 여기서 사슬을 두드린다. 재는 것은 다섯이다.
//
// 1. **웹이 산다** — 주소가 HTML을 준다
// 2. **묶음이 산다** — 그 HTML이 가리키는 자바스크립트가 실제로 받아진다
// 3. **개발용 응답이 안 실렸다** — 그 묶음에 가짜에만 있는 글이 없다
// 4. **api가 산다** — Worker가 Render로 넘기고 서버가 계약대로 답한다
// 5. **저장소가 산다** — 없는 것을 물으면 404다. 500이면 Neon이 끊긴 것이다
//
// ## 아직 안 재는 것 (정직하게)
//
// **로그인한 뒤의 화면은 못 본다.** 구글을 다녀와야 하고 그 열쇠는 저장소에 없다.
// 오늘 사람이 찾은 둘(로딩·박힌 4건)이 정확히 그 자리다 — 이 눈금은 그 둘을 못 잡는다.
// 잡으려면 시험용 사람이 열쇠 없이 들어오는 길이 있어야 하는데, 그 길은 그 자체가
// 구멍이다. 그 자리는 백로그에 있다.
//
//     npm run smoke                 배포된 곳
//     SMOKE_URL=... npm run smoke   다른 곳
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

// **비밀이 아니다.** 사람이 여는 주소이고 브라우저 주소창에 그대로 들어 있다.
const SITE = (process.env.SMOKE_URL ?? 'https://vada.vadahq-ops.workers.dev').replace(/\/$/, '')

// 배포는 푸시가 시작하고 우리 손을 벗어나 돈다. 갓 민 뒤에 두드리면 아직 옛 묶음이
// 거나 아직 안 떠 있다 — 몇 번 기다린다. **끝내 안 서면 그것이 판정이다.**
const TRIES = Number(process.env.SMOKE_TRIES ?? 6)
const WAIT_MS = Number(process.env.SMOKE_WAIT_MS ?? 10_000)

const failures = []
const notes = []

function check(what, ok, detail) {
  if (ok) {
    notes.push(`  ✓ ${what}`)
    return true
  }
  failures.push(`  ✗ ${what}${detail === undefined ? '' : ` — ${detail}`}`)
  return false
}

async function get(path, init) {
  const res = await fetch(`${SITE}${path}`, { redirect: 'manual', ...init })
  return { status: res.status, text: await res.text(), type: res.headers.get('content-type') ?? '' }
}

/** 서는 것을 기다린다. 배포가 아직 안 끝났을 수 있다. */
async function waitForSite() {
  for (let attempt = 1; attempt <= TRIES; attempt += 1) {
    try {
      const res = await get('/')
      if (res.status === 200) return res
      process.stdout.write(`[연기] ${attempt}/${TRIES} — 웹이 ${res.status}입니다. 기다립니다.\n`)
    } catch (error) {
      process.stdout.write(`[연기] ${attempt}/${TRIES} — 닿지 못했습니다(${String(error).slice(0, 60)}).\n`)
    }
    if (attempt < TRIES) await new Promise((resolve) => setTimeout(resolve, WAIT_MS))
  }
  return null
}

process.stdout.write(`[연기] ${SITE}를 두드립니다.\n`)

// ── 1. 웹이 산다
const home = await waitForSite()
if (home === null) {
  process.stderr.write(`\n[연기] **웹이 서지 않았습니다.** ${TRIES}번 두드렸습니다.\n`)
  process.exit(1)
}
check('웹이 HTML을 준다', home.type.includes('text/html'), `content-type: ${home.type}`)

// ── 2. 묶음이 산다
const scripts = [...home.text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((found) => found[1])
check('HTML이 묶음을 가리킨다', scripts.length > 0, 'script 태그가 없습니다')
let bundle = ''
for (const src of scripts) {
  const res = await get(src)
  if (!check(`묶음이 받아진다 (${src})`, res.status === 200, `${res.status}`)) continue
  bundle += res.text
}

// ── 3. 개발용 응답이 안 실렸다
//
// **나가는 묶음을 짓는 자리에서 이미 잰다**(`no-fixtures-in-ship.mjs`). 그런데 그것은
// 이 기계가 만든 `dist/`를 보고, 사람이 여는 것은 Cloudflare가 만든 묶음이다. 둘이
// 갈릴 자리가 빌드 설정이고, 갈리면 남의 학생회가 다시 보인다.
const expected = JSON.parse(
  readFileSync(join(repoRoot, 'apps', 'vada-web', 'e2e-ship', 'canary-expect.json'), 'utf8'),
)
//
// **빈 것에 대고 재면 늘 통과한다.** 묶음을 하나도 못 받았는데 '가짜가 없다'고 말하면
// 그것은 눈금이 아니다 — 이 저장소가 이미 두 번 겪은 모양이다(거르는 그물은 자기가
// 거른 것을 못 본다). 그래서 찾기 전에 **찾을 것이 있는지** 먼저 잰다.
check('묶음에 잴 것이 있다', bundle.length > 50_000, `${bundle.length}자`)
const leaked = expected.words.filter((word) => bundle.includes(word))
check(
  `개발용 응답이 안 실렸다 (글 ${expected.words.length}개를 찾아봄)`,
  bundle.length > 50_000 && leaked.length === 0,
  leaked.slice(0, 5).join(' · '),
)

// ── 4. api가 산다 — Worker → Render → 서버
const ways = await get('/api/sign-in/ways')
if (check('Worker가 api로 넘긴다', ways.status === 200, `${ways.status}`)) {
  let body = null
  try {
    body = JSON.parse(ways.text)
  } catch {
    /* 아래에서 잡는다 */
  }
  check(
    '들어오는 길이 계약의 모양으로 온다',
    body !== null && typeof body.google === 'boolean' && typeof body.kakao === 'boolean',
    ways.text.slice(0, 80),
  )
  check(
    '들어올 길이 하나는 열려 있다',
    body !== null && (body.google === true || body.kakao === true),
    '구글도 카카오도 닫혀 있습니다 — 아무도 못 들어옵니다',
  )
}

// ── 5. 저장소가 산다
//
// 없는 참석 토큰을 묻는다. **404가 옳은 답이다** — 표까지 갔는데 그런 것이 없다는
// 뜻이다. 500이면 그 앞에서 끊긴 것이고, 그것은 Neon이 죽었거나 설정이 틀린 것이다.
const missing = await get('/api/public/attendance/check-in-form?checkInToken=SMOKE-NONE')
//
// **아무 404나 다 같지 않다.** 남의 서버도 404를 낸다 — 우리 서버가 답한 404여야
// 표까지 닿았다는 뜻이고, 그것은 몸통의 모양이 말한다(`{ message }`).
let missingBody = null
try {
  missingBody = JSON.parse(missing.text)
} catch {
  /* 아래에서 잡는다 */
}
check(
  '저장소까지 닿는다 (없는 것은 우리 서버의 404)',
  (missing.status === 404 || missing.status === 429) &&
    missingBody !== null &&
    typeof missingBody.message === 'string',
  `${missing.status} ${missing.text.slice(0, 80)}`,
)

process.stdout.write(`\n${notes.join('\n')}\n`)
if (failures.length > 0) {
  process.stderr.write(`\n[연기] **${failures.length}곳이 어긋났습니다.**\n${failures.join('\n')}\n`)
  process.exit(1)
}
process.stdout.write('\n[연기] 배포된 사슬이 살아 있습니다.\n')
