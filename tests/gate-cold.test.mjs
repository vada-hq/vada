// **원격 게이트는 차갑게 돈다.**
//
// 검사가 변환한 것을 다음 실행까지 남긴다(`fsModuleCache`). 사람의 기계에서 검사
// 파일 하나를 다시 재는 데 20.8초가 들었고 그중 실제 테스트는 1.6초였다 — 나머지는
// 매번 처음부터 다시 하는 변환이다(2026-09-09에 쟀다).
//
// 그 대가로 위험이 하나 생긴다: **캐시가 어긋나면 옛 코드에 초록이 뜬다.** 이
// 저장소가 사는 방식이 '눈금을 만들고 심어서 터뜨려 증명한다'인데, 저울이 옛 것을
// 재고 있으면 그 전부가 무의미해진다.
//
// 막는 것은 원격 게이트다. 캐시는 `node_modules/.vite`에 살고 CI는 매번 새 러너에서
// `npm ci`로 시작하므로 **거기서는 캐시가 없다.** 내 기계에서만 초록인 것은 거기서
// 걸린다.
//
// **그 성질은 지금 우연히 참이다.** 누가 게이트를 빠르게 하려고 `actions/cache`를
// 심으면 조용히 사라진다 — 그때는 두 곳 다 캐시를 믿게 되고 막는 자리가 없어진다.
// 그래서 여기서 지킨다.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const GATE = readFileSync(
  fileURLToPath(new URL('../.github/workflows/gate.yml', import.meta.url)),
  'utf-8',
)

test('원격 게이트가 검사 캐시를 물려주지 않는다', () => {
  // `actions/cache`가 아예 없으면 무엇을 담든 차갑다.
  const caches = GATE.includes('actions/cache')
  assert.equal(
    caches,
    false,
    '게이트에 캐시 단계가 생겼습니다. 검사의 변환 캐시(node_modules/.vite)까지 물려주면 ' +
      '사람의 기계와 원격이 같은 캐시를 믿게 되어, 옛 코드에 초록이 뜨는 것을 막는 자리가 없어집니다. ' +
      '담을 것이 있으면 node_modules/.vite는 빼세요.',
  )
})

// **빈 것에 대고 재면 늘 통과한다.** 게이트가 검사를 안 돌리면 위 규칙은 지켜지는데
// 지킬 것이 없다.
test('원격 게이트가 검사를 실제로 돌린다', () => {
  assert.ok(GATE.includes('npm run test'), '게이트가 검사를 돌리지 않습니다.')
  assert.ok(GATE.includes('npm ci'), '게이트가 새로 설치하지 않습니다.')
})
