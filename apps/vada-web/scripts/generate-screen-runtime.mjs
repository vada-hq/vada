import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const specsRoot = join(appRoot, '..', '..', 'specs', 'figma', 'vada-wireframe', 'screens')
const modulesRoot = join(appRoot, 'src', 'spec', 'screen-specs')
const runtimePath = join(appRoot, 'src', 'spec', 'screen-runtime.generated.ts')
const checkOnly = process.argv.includes('--check')

function exportNameOf(screenId) {
  return screenId.toLowerCase().replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase())
}

function screenSpecs() {
  return readdirSync(specsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(specsRoot, entry.name, 'screen.json')
      if (!existsSync(path)) return null
      const screen = JSON.parse(readFileSync(path, 'utf8'))
      if (screen.screenId !== entry.name) {
        throw new Error(`화면 폴더 '${entry.name}'와 screenId '${screen.screenId}'가 다릅니다.`)
      }
      return screen
    })
    .filter((screen) => screen !== null)
    .sort((left, right) => left.screenId.localeCompare(right.screenId))
}

function sourceReferencesOf(screen) {
  const references = new Map()
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node === null || typeof node !== 'object') return
    if (typeof node.dataSourceKey === 'string') {
      const reference = {
        dataSourceKey: node.dataSourceKey,
        ...(node.params === undefined ? {} : { params: node.params }),
      }
      references.set(JSON.stringify(reference), reference)
    }
    for (const [name, value] of Object.entries(node)) {
      if (name === 'optionsSource' || name === 'params') continue
      walk(value)
    }
  }
  walk(screen)
  return [...references.values()]
}

function draftFieldsOf(screens) {
  const scopes = new Map()
  const walk = (node, found) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, found)
      return
    }
    if (node === null || typeof node !== 'object') return
    if (typeof node.fieldKey === 'string' && node.valueType === 'boolean') {
      found.booleans.add(node.fieldKey)
    }
    if (node.type === 'list' && typeof node.fieldKey === 'string' && !found.lists.has(node.fieldKey)) {
      found.lists.set(node.fieldKey, {
        fieldKey: node.fieldKey,
        ...(node.itemValueKey === undefined ? {} : { itemValueKey: node.itemValueKey }),
      })
    }
    for (const value of Object.values(node)) walk(value, found)
  }
  for (const screen of screens) {
    if (typeof screen.stateScopeKey !== 'string') continue
    const found = scopes.get(screen.stateScopeKey) ?? {
      booleans: new Set(),
      lists: new Map(),
    }
    walk(screen, found)
    scopes.set(screen.stateScopeKey, found)
  }
  return Object.fromEntries(
    [...scopes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([scope, fields]) => [scope, {
        booleans: [...fields.booleans].sort(),
        lists: [...fields.lists.values()].sort((left, right) => left.fieldKey.localeCompare(right.fieldKey)),
      }]),
  )
}

function runtimeSource(screens) {
  const runtime = screens.map((screen) => ({
    screenId: screen.screenId,
    drawable: screen.elements.length > 0,
    ...(screen.stateScopeKey === undefined ? {} : { stateScopeKey: screen.stateScopeKey }),
    ...(screen.viewer === undefined ? {} : { viewer: screen.viewer }),
    ...(screen.workspace?.key === undefined ? {} : { workspace: { key: screen.workspace.key } }),
    ...(screen.meta === undefined ? {} : {
      meta: {
        ...(screen.meta.eyebrow === undefined ? {} : { eyebrow: screen.meta.eyebrow }),
        title: screen.meta.title,
      },
    }),
    sourceReferences: sourceReferencesOf(screen),
  }))
  return `// 자동 생성: npm run generate:screen-runtime. 직접 수정하지 않는다.\n` +
    `import type { QueryParams, ScreenSpec } from './types'\n\n` +
    `export interface RuntimeSourceReference {\n` +
    `  dataSourceKey: string\n` +
    `  params?: QueryParams\n` +
    `}\n\n` +
    `export interface RuntimeScreenSpec {\n` +
    `  screenId: string\n` +
    `  drawable: boolean\n` +
    `  stateScopeKey?: string\n` +
    `  viewer?: ScreenSpec['viewer']\n` +
    `  workspace?: { key: string }\n` +
    `  meta?: { eyebrow?: string | null; title: string }\n` +
    `  sourceReferences: readonly RuntimeSourceReference[]\n` +
    `}\n\n` +
    `export const SCREEN_RUNTIME = ${JSON.stringify(runtime, null, 2)} as const satisfies readonly RuntimeScreenSpec[]\n\n` +
    `const BY_ID = new Map<string, RuntimeScreenSpec>(\n` +
    `  SCREEN_RUNTIME.map((screen) => [screen.screenId, screen]),\n` +
    `)\n\n` +
    `export function findScreenRuntime(screenId: string): RuntimeScreenSpec | undefined {\n` +
    `  return BY_ID.get(screenId)\n` +
    `}\n\n` +
    `export function stateScopeKeyOf(screenId: string): string | undefined {\n` +
    `  return findScreenRuntime(screenId)?.stateScopeKey\n` +
    `}\n\n` +
    `export const DRAWABLE_SCREEN_RUNTIME = SCREEN_RUNTIME.filter((screen) => screen.drawable)\n\n` +
    `export interface RuntimeDraftFields {\n` +
    `  booleans: readonly string[]\n` +
    `  lists: readonly { fieldKey: string; itemValueKey?: string }[]\n` +
    `}\n\n` +
    `export const DRAFT_FIELDS_BY_SCOPE: Readonly<Record<string, RuntimeDraftFields>> = ${JSON.stringify(draftFieldsOf(screens), null, 2)}\n`
}

function moduleSource(screenId) {
  const exportName = exportNameOf(screenId)
  return `// 자동 생성: npm run generate:screen-runtime. 직접 수정하지 않는다.\n` +
    `import screenJson from '../../../../../specs/figma/vada-wireframe/screens/${screenId}/screen.json'\n` +
    `import { asScreenSpec } from '../screen-guard'\n\n` +
    `export const ${exportName} = asScreenSpec(screenJson, '${screenId}')\n`
}

function assertSame(path, expected) {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
    process.stderr.write(`화면 실행 명세가 최신이 아닙니다: ${path}\n`)
    process.exitCode = 1
  }
}

const screens = screenSpecs()
const expectedModules = new Map(
  screens.map((screen) => [`${exportNameOf(screen.screenId)}.ts`, moduleSource(screen.screenId)]),
)
if (expectedModules.size !== screens.length) {
  throw new Error('서로 다른 화면 ID가 같은 TypeScript export 이름으로 바뀝니다.')
}

if (checkOnly) {
  assertSame(runtimePath, runtimeSource(screens))
  const actualNames = existsSync(modulesRoot)
    ? readdirSync(modulesRoot).filter((name) => name.endsWith('.ts')).sort()
    : []
  const expectedNames = [...expectedModules.keys()].sort()
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    process.stderr.write('화면별 실행 명세 파일 목록이 최신이 아닙니다.\n')
    process.exitCode = 1
  }
  for (const [name, source] of expectedModules) assertSame(join(modulesRoot, name), source)
} else {
  mkdirSync(modulesRoot, { recursive: true })
  for (const name of readdirSync(modulesRoot)) {
    if (name.endsWith('.ts') && !expectedModules.has(name)) unlinkSync(join(modulesRoot, name))
  }
  writeFileSync(runtimePath, runtimeSource(screens), 'utf8')
  for (const [name, source] of expectedModules) writeFileSync(join(modulesRoot, name), source, 'utf8')
  process.stdout.write(`화면 실행 명세 ${screens.length}개를 갱신했습니다.\n`)
}
