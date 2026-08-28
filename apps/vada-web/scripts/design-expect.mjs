import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// 화면을 그리기 **전에** design이 무엇을 말하는지 묻는 자리.
//
//   node apps/vada-web/scripts/design-expect.mjs OPS-MEET-02
//
// 판정 코드는 TypeScript로 design-check 안에 있다(같은 표를 대조와 나눠 써야
// 알려준 값과 견주는 값이 갈리지 않는다). 이 저장소에 TS 실행기가 따로 없으므로
// vite의 로더를 그대로 빌려 쓴다 — vite는 이미 이 앱의 의존성이다.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const screenId = process.argv[2]

if (!screenId) {
  console.error('화면 아이디가 필요합니다. 예: OPS-MEET-02')
  process.exit(2)
}

const screenDir = join(app, '../../specs/figma/vada-wireframe/screens', screenId)
const specFile = join(screenDir, 'screen.json')
const designFile = join(screenDir, 'figma.design.json')

for (const file of [specFile, designFile]) {
  if (!existsSync(file)) {
    console.error(`${file}이(가) 없습니다.`)
    process.exit(1)
  }
}

const server = await createServer({
  root: app,
  configFile: false,
  // 개발 서버와 같은 캐시를 쓰면 설정이 다르다며 서로 다시 최적화한다.
  // 이 도구는 제 자리에 캐시한다.
  cacheDir: join(app, 'node_modules/.vite-design-expect'),
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  const { expectationsOf, formatExpectations } = await server.ssrLoadModule(
    '/src/design-check/expectations.ts',
  )

  const screen = JSON.parse(readFileSync(specFile, 'utf-8'))
  const design = JSON.parse(readFileSync(designFile, 'utf-8'))

  console.log(formatExpectations(screenId, expectationsOf(screen, design)))
} finally {
  await server.close()
}
