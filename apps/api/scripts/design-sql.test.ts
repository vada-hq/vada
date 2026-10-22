import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AUTH_STATEMENTS,
  BREAKPOINT,
  NOT_IN_DESIGN,
  OUTSIDE_STATEMENTS,
  baselineOf,
  designBlock,
  joinStatements,
  splitStatements,
} from './design-sql.js'

const markdown = [
  '# physical-model.md',
  '',
  '```sql',
  'CREATE EXTENSION IF NOT EXISTS btree_gist;',
  '',
  '-- 공통 ----',
  '',
  'CREATE TABLE a (',
  '  id uuid PRIMARY KEY,  -- 설명',
  '  kind text NOT NULL',
  ');',
  "CREATE UNIQUE INDEX ON a (id) WHERE kind = 'x';  -- 끝에 붙은 주석",
  '-- 주석 줄의 ;은 문장의 끝이 아니다;',
  'CREATE INDEX ON a (kind);',
  '```',
].join('\r\n')

test('designBlock은 SQL 블록 하나를 LF로 꺼낸다', () => {
  const block = designBlock(markdown)
  assert.ok(block.startsWith('CREATE EXTENSION IF NOT EXISTS btree_gist;'))
  assert.ok(block.endsWith('CREATE INDEX ON a (kind);'))
  assert.ok(!block.includes('\r'))
  assert.throws(() => designBlock('# 표 없음'))
  assert.throws(() => designBlock('```sql\nCREATE TABLE a (id int);'))
})

test('designBlock은 SQL 블록이 둘 이상이면 어느 쪽이 설계인지 알 수 없어 멈춘다', () => {
  const second = '\r\n\r\n```sql\r\nCREATE TABLE ignored (id int);\r\n```\r\n'
  assert.throws(() => designBlock(markdown + second), /둘 이상/)
  assert.throws(() => baselineOf(markdown + second), /둘 이상/)
})

test('splitStatements는 줄 끝 ;에서 나누고, 끝에 붙은 주석과 앞의 주석 줄을 그 문장에 둔다', () => {
  const statements = splitStatements(designBlock(markdown))
  assert.deepEqual(statements, [
    'CREATE EXTENSION IF NOT EXISTS btree_gist;',
    '-- 공통 ----\n\nCREATE TABLE a (\n  id uuid PRIMARY KEY,  -- 설명\n  kind text NOT NULL\n);',
    "CREATE UNIQUE INDEX ON a (id) WHERE kind = 'x';  -- 끝에 붙은 주석",
    '-- 주석 줄의 ;은 문장의 끝이 아니다;\nCREATE INDEX ON a (kind);',
  ])
  assert.throws(() => splitStatements('CREATE TABLE a (id int)'))
  assert.deepEqual(splitStatements('CREATE TABLE a (id int);\n-- 끝의 주석만 남으면 버린다\n'), [
    'CREATE TABLE a (id int);',
  ])
})

test('baselineOf는 로그인 표, 설계 블록, 설계 밖 표 순서로 문장 사이에만 표시를 넣는다', () => {
  const sql = baselineOf(markdown)
  assert.ok(!sql.includes('\r'))
  assert.ok(sql.endsWith('CREATE INDEX ON push_device (user_id);\n'))
  const pieces = sql.split(BREAKPOINT)
  assert.equal(pieces.length, AUTH_STATEMENTS.length + 4 + OUTSIDE_STATEMENTS.length)
  assert.ok(pieces[0]!.includes('CREATE TABLE "users"'))
  assert.ok(pieces[AUTH_STATEMENTS.length]!.includes('CREATE EXTENSION IF NOT EXISTS btree_gist;'))
  assert.ok(pieces[AUTH_STATEMENTS.length + 4]!.includes('CREATE TABLE member_login'))
  assert.equal(joinStatements(['a;', 'b;']), `a;\n${BREAKPOINT}\nb;`)
})

test('설계 검사에서 빼는 표는 로그인 표 4개와 설계 밖 표 6개다', () => {
  assert.deepEqual([...NOT_IN_DESIGN].sort(), [
    'accounts',
    'applicant_access_log',
    'invite_code',
    'member_login',
    'push_device',
    'registration_link',
    'sessions',
    'terms_agreement',
    'users',
    'verifications',
  ])
})
