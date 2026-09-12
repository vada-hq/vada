import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const render = readFileSync(join(repoRoot, 'render.yaml'), 'utf8')
const configuredDockerfile = /^    dockerfilePath: (.+)$/m.exec(render)?.[1].trim()
assert.ok(configuredDockerfile, 'Render의 Dockerfile 경로가 필요합니다')
const dockerfilePath = posix.normalize(configuredDockerfile)
const dockerfile = readFileSync(join(repoRoot, dockerfilePath), 'utf8')

// render.yaml의 들여쓴 경로 목록만 읽는다. Render와 같은 포함/제외 우선순위를
// 적용해, 화면 수정 때문에 API가 다시 뜨거나 API 변경이 배포에서 빠지는 것을 잡는다.
const filter = /^    buildFilter:\r?\n((?: {6,}[^\r\n]*\r?\n)*)/m.exec(render)?.[1] ?? ''
function pathsOf(key) {
  const block = new RegExp(`^      ${key}:\\r?\\n((?: {8}- [^\\r\\n]+\\r?\\n)*)`, 'm')
    .exec(filter)?.[1] ?? ''
  return [...block.matchAll(/^ {8}- (.+)$/gm)].map((match) => match[1].trim())
}

const included = pathsOf('paths')
const ignored = pathsOf('ignoredPaths')
function triggersDeploy(changedPaths) {
  return changedPaths.some((path) =>
    (included.length === 0 || included.some((pattern) => posix.matchesGlob(path, pattern))) &&
    !ignored.some((pattern) => posix.matchesGlob(path, pattern)),
  )
}

test('화면·Worker·웹 의존성·문서 변경만으로는 API를 재배포하지 않는다', () => {
  assert.ok(included.length > 0, 'API 배포 대상을 제한하는 buildFilter.paths가 필요합니다')
  for (const path of [
    'apps/vada-web/src/screens/OPSMEET02Screen.tsx',
    'apps/vada-web/src/screens/meeting-editor/meeting-draft.ts',
    'apps/vada-web/worker/index.ts',
    'apps/vada-web/package-lock.json',
    'apps/vada-web/wrangler.jsonc',
    'apps/spec-service/src/validate-specs.mjs',
    'packages/contracts/src/button-execution.mjs',
    'docs/decisions/deployment.md',
    'tests/deploy-filter.test.mjs',
  ]) {
    assert.equal(triggersDeploy([path]), false, path)
  }
})

test('Docker가 복사하는 입력과 API 실행·DB 옮김·배포 설정 변경은 배포한다', () => {
  assert.equal(triggersDeploy([dockerfilePath]), true, dockerfilePath)
  // COPY에 새로운 입력 디렉터리를 더하면 필터도 함께 확인하게 한다.
  for (const [, sources] of dockerfile.matchAll(/^COPY (.+) \S+\r?$/gm)) {
    for (const source of sources.split(/\s+/)) {
      if (statSync(join(repoRoot, source)).isDirectory()) {
        assert.equal(triggersDeploy([`${source}/new-file.json`]), true, source)
        assert.equal(triggersDeploy([`${source}/nested/new-file.json`]), true, source)
      } else {
        assert.equal(triggersDeploy([source]), true, `Docker COPY 입력: ${source}`)
      }
    }
  }
  for (const path of [
    'apps/api/src/serve.ts',
    'apps/api/package-lock.json',
    'apps/api/migrations/next.sql',
    'specs/figma/vada-wireframe/openapi.json',
    'specs/figma/vada-wireframe/permissions.json',
    'specs/figma/vada-wireframe/option-sources.json',
    '.dockerignore',
    'render.yaml',
  ]) {
    assert.equal(triggersDeploy([path]), true, path)
  }
  assert.equal(triggersDeploy(['apps/vada-web/src/App.tsx', 'apps/api/src/serve.ts']), true)
})

test('공용 명세를 읽을 수 있도록 Docker 빌드 문맥은 저장소 루트다', () => {
  assert.match(render, /^    dockerContext: \.\r?$/m)
  assert.doesNotMatch(render, /^\s*rootDir:/m)
})
