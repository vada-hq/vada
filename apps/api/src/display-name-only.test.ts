import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { test } from 'node:test'

// 운영진 이름을 직접 읽으면 탈퇴한 사람이 그 곳에서만 빈 이름으로 보인다(DEC-54 '떠난 운영진 N').
// 이름은 team/display-name.ts의 도우미로만 읽는다. alias(member, …)나 다른 이름으로 가져온 member도 같다.
// 서버 코드(src)와 운영 명령(scripts)을 함께 본다.
const root = join(import.meta.dirname, '..')
const HELPER = 'src/team/display-name.ts'
// 학생회 기록에 보이는 이름이 아니라 로그인한 사람 자신의 이름을 읽는 곳. 이유 없이 늘리지 않는다.
const ALLOWED = new Map([
  [
    'src/profile/service.ts',
    '내 이름. 로그인에 이어진 운영진 자신이고, 탈퇴하면 그 잇기가 지워진다',
  ],
  [
    'src/councils/link.ts',
    '로그인을 잇는 운영진을 이메일로 찾는다. 탈퇴한 운영진은 이메일이 비어 찾히지 않는다',
  ],
])
const isChecked = (file: string) =>
  file.endsWith('.ts') &&
  !file.endsWith('.test.ts') &&
  !file.includes('test-support/') &&
  !file.endsWith('test-db.ts') &&
  file !== HELPER &&
  !ALLOWED.has(file)

function sourcesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? sourcesOf(join(dir, entry.name))
      : [relative(root, join(dir, entry.name)).split(sep).join('/')],
  )
}

// member를 가리키는 이름: member, alias(member, …)의 이름, `member as x`로 가져온 이름.
const ALIAS = /\b(\w+)\s*=\s*alias\(\s*member\s*,/g
const RENAMED = /\bmember\s+as\s+(\w+)/g
const commentOnly = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line)

// 이름 칸을 읽는 꼴: t.name, t['name'], getTableColumns(t), select().from(t)(모든 칸), { name } = t.
function readsOf(tables: string[]) {
  const t = `(?:${tables.join('|')})`
  return [
    new RegExp(`\\b${t}\\s*(?:\\.\\s*name\\b|\\[\\s*['"\`]name['"\`]\\s*\\])`, 'g'),
    new RegExp(`getTableColumns\\(\\s*${t}\\s*\\)`, 'g'),
    new RegExp(`\\.select\\(\\s*\\)\\s*\\.from\\(\\s*${t}\\s*\\)`, 'g'),
    new RegExp(`\\{[^}]*\\bname\\b[^}]*\\}\\s*=\\s*${t}\\b`, 'g'),
  ]
}

// 운영진 표의 name 칸을 읽는 줄 번호(1부터).
function directNameReads(source: string): number[] {
  const tables = [
    'member',
    ...[...source.matchAll(ALIAS), ...source.matchAll(RENAMED)].map(match => match[1]!),
  ]
  const code = source
    .split('\n')
    .map(line => (commentOnly(line) ? '' : line))
    .join('\n')
  const lineOf = (index: number) => code.slice(0, index).split('\n').length
  const lines = readsOf(tables).flatMap(read =>
    [...code.matchAll(read)].map(match => lineOf(match.index)),
  )
  return [...new Set(lines)].sort((a, b) => a - b)
}

test('서버 코드와 운영 명령은 운영진 이름을 표시 이름 도우미 밖에서 읽지 않는다', () => {
  const found = ['src', 'scripts']
    .flatMap(dir => sourcesOf(join(root, dir)))
    .filter(isChecked)
    .flatMap(file =>
      directNameReads(readFileSync(join(root, file), 'utf8')).map(line => `${file}:${line}`),
    )
  assert.deepEqual(
    found,
    [],
    'displayNameOf(member, 학생회 번호)로 읽는다. 자기 이름만 읽는 곳이면 ALLOWED에 이유와 함께 적는다',
  )
})

test('판별 규칙: member와 그 alias·다른 이름의 name 읽기가 걸린다', () => {
  assert.deepEqual(directNameReads('  senderName: member.name,'), [1])
  assert.deepEqual(directNameReads("  senderName: member['name'],"), [1])
  assert.deepEqual(directNameReads('  senderName: member [ "name" ],'), [1])
  assert.deepEqual(
    directNameReads("const payer = alias(member, 'payer')\nx\n  payerName: payer.name,"),
    [3],
  )
  assert.deepEqual(
    directNameReads("import { member as people } from '../db/schema.js'\n  x: people.name,"),
    [2],
  )
  assert.deepEqual(directNameReads('  .select(getTableColumns(member))'), [1])
  assert.deepEqual(directNameReads('  .select()\n  .from(member)'), [1])
  assert.deepEqual(directNameReads('const { id, name } = member'), [1])
  assert.deepEqual(
    directNameReads(
      '  name: department.name,\n  name: displayNameOf(member, id)\n  .select().from(department)',
    ),
    [],
  )
  assert.deepEqual(directNameReads('// member.name은 쓰지 않는다'), [])
})
