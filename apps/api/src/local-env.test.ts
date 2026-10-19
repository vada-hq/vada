import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { readLocalEnv, repoEnvPath } from './local-env.js'

// 이 .env를 쓰는 파일들의 폴더(apps/api/src, apps/api/src/db, apps/api/scripts). 위치가 달라도 같은 파일을 가리켜야 한다.
const callerDirs = ['apps/api/src', 'apps/api/src/db', 'apps/api/scripts']

test('저장소 맨 위의 .env 하나를 가리킨다: 부르는 파일의 위치와 상관없다(내용은 읽지 않는다)', () => {
  const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)))
  const expected = join(repoRoot, '.env')
  assert.equal(repoEnvPath(), expected)
  for (const dir of callerDirs) assert.equal(repoEnvPath(join(repoRoot, dir)), expected, dir)
})

test('임시 폴더에서도 .node-version이 있는 맨 위의 .env를 찾고, 안쪽 폴더의 package.json에 속지 않는다', () => {
  const root = mkdtempSync(join(tmpdir(), 'vada-env-'))
  try {
    writeFileSync(join(root, '.node-version'), '')
    for (const dir of callerDirs) {
      mkdirSync(join(root, dir), { recursive: true })
      writeFileSync(join(root, dir, 'package.json'), '{}')
    }
    for (const dir of callerDirs)
      assert.equal(repoEnvPath(join(root, dir)), join(root, '.env'), dir)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('저장소 맨 위를 찾지 못하면 멈춘다', () => {
  const root = mkdtempSync(join(tmpdir(), 'vada-env-'))
  try {
    assert.throws(() => repoEnvPath(root), /저장소 맨 위/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readLocalEnv는 준 경로의 파일을 환경 변수 모양으로 읽고, 없으면 ENOENT를 그대로 던진다', () => {
  const root = mkdtempSync(join(tmpdir(), 'vada-env-'))
  try {
    writeFileSync(join(root, '.env'), 'DUMMY_KEY=dummy-value\n# 주석\n')
    assert.deepEqual(readLocalEnv(join(root, '.env')), { DUMMY_KEY: 'dummy-value' })
    assert.throws(() => readLocalEnv(join(root, 'missing.env')), { code: 'ENOENT' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
