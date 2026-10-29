import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { localMigrations, type LocalMigration } from './migrate-check.js'
import { runMigration } from './migrate-run.js'
import { migrationsFolder } from '../../db/test-db.js'

// 실제 DB에는 닿지 않는다. connect는 PGlite를 감싼 가짜이고, 불린 횟수를 센다.
const URL_WITH_PASSWORD = 'postgres://u:secret@h/db'
const real = localMigrations(migrationsFolder)
const rowsOf = (pg: PGlite) => async (text: string) =>
  (await pg.query<Record<string, unknown>>(text)).rows

type Setup = {
  args?: string[]
  env?: { npm_config_dry_run?: string }
  shellUrl?: string
  readEnvUrl?: () => string | undefined
  readLocal?: () => LocalMigration[]
  query?: (text: string) => Promise<Record<string, unknown>[]>
  apply?: () => Promise<void>
  end?: () => Promise<void>
}

function harness(pg: PGlite | undefined, setup: Setup = {}) {
  const calls = { readEnvUrl: 0, connect: 0, apply: 0, end: 0, urls: [] as string[] }
  const lines: string[] = []
  const run = () =>
    runMigration({
      args: setup.args ?? [],
      env: setup.env ?? {},
      shellUrl: setup.shellUrl,
      readEnvUrl: () => {
        calls.readEnvUrl += 1
        return setup.readEnvUrl ? setup.readEnvUrl() : URL_WITH_PASSWORD
      },
      readLocal: setup.readLocal ?? (() => real),
      connect: url => {
        calls.connect += 1
        calls.urls.push(url)
        return {
          query: setup.query ?? rowsOf(pg!),
          apply: async () => {
            calls.apply += 1
            await (setup.apply ?? (() => migrate(drizzle(pg!), { migrationsFolder })))()
          },
          end: async () => {
            calls.end += 1
            await setup.end?.()
          },
        }
      },
      log: { info: line => lines.push(line), error: line => lines.push(line) },
    })
  return { calls, lines, run }
}

const noSecret = (lines: string[]) =>
  assert.ok(
    lines.every(line => !line.includes('secret') && !line.includes('postgres://')),
    lines.join('\n'),
  )
const publicTables = async (pg: PGlite) =>
  (
    await pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
    )
  ).rows[0]!.n

test('멈추는 길은 .env를 읽지도 연결하지도 않는다', async () => {
  const cases: [string, Setup, RegExp][] = [
    ['오타', { args: ['--dryrun'] }, /알 수 없는 인자/],
    ['짧은 오타', { args: ['-n'] }, /알 수 없는 인자/],
    ['값', { args: ['dev'] }, /알 수 없는 인자/],
    ['주소를 값으로 줌', { args: ['--apply', URL_WITH_PASSWORD] }, /알 수 없는 인자/],
    ['--apply와 --dry-run', { args: ['--apply', '--dry-run'] }, /같이 줄 수 없다/],
    [
      'npm이 --dry-run을 삼킴',
      { args: ['--apply'], env: { npm_config_dry_run: 'true' } },
      /--를 붙인다/,
    ],
    // 이미 --를 줬는데도 삼켰다면 .npmrc나 환경 변수가 dry-run을 켠 것이다.
    [
      '삼킨 원인이 설정일 때의 안내',
      { args: ['--apply'], env: { npm_config_dry_run: 'true' } },
      /\.npmrc.*NPM_CONFIG_DRY_RUN/,
    ],
    ['플래그 없이 셸에 주소', { shellUrl: URL_WITH_PASSWORD }, /--from-shell을 붙이고/],
    ['셸 주소 없이 플래그', { args: ['--from-shell'] }, /셸에 DATABASE_URL이 없다/],
    ['셸 주소가 공백뿐', { args: ['--from-shell'], shellUrl: '   ' }, /셸에 DATABASE_URL이 없다/],
  ]
  for (const [label, setup, message] of cases) {
    const { calls, lines, run } = harness(undefined, setup)
    assert.equal(await run(), 1, label)
    assert.equal(calls.readEnvUrl, 0, label)
    assert.equal(calls.connect, 0, label)
    assert.equal(calls.apply, 0, label)
    assert.ok(
      lines.some(line => message.test(line)),
      `${label}: ${lines.join(' | ')}`,
    )
    noSecret(lines)
  }
})

test('미리 보기는 기본이다: 대상과 점검만 보여 주고 아무것도 바꾸지 않는다', async () => {
  const pg = await PGlite.create()
  try {
    for (const args of [[], ['--dry-run']]) {
      const { calls, lines, run } = harness(pg, { args })
      assert.equal(await run(), 0, JSON.stringify(args))
      assert.deepEqual(
        [calls.readEnvUrl, calls.connect, calls.apply, calls.end],
        [1, 1, 0, 1],
        JSON.stringify(args),
      )
      assert.ok(lines.includes('대상: h/db (.env)'), lines.join(' | '))
      assert.ok(
        lines.some(line => /^public 표 0개, 적용 기록 없음, 로컬 마이그레이션 \d+개$/.test(line)),
        lines.join(' | '),
      )
      assert.ok(
        lines.some(
          line =>
            line.includes(`적용할 마이그레이션 ${real.length}개`) &&
            line.includes('미리 보기') &&
            line.includes('pnpm --filter @vada/api db:migrate --apply'),
        ),
        lines.join(' | '),
      )
      noSecret(lines)
    }
    // 셸 주소는 --from-shell을 줄 때만 쓰고, 그때는 .env를 읽지 않는다.
    const shell = harness(pg, { args: ['--from-shell'], shellUrl: ` ${URL_WITH_PASSWORD} ` })
    assert.equal(await shell.run(), 0)
    assert.deepEqual(
      [shell.calls.readEnvUrl, shell.calls.connect, shell.calls.apply, shell.calls.end],
      [0, 1, 0, 1],
    )
    assert.deepEqual(shell.calls.urls, [URL_WITH_PASSWORD])
    assert.ok(shell.lines.includes('대상: h/db (셸의 DATABASE_URL)'), shell.lines.join(' | '))
    // 안내는 그대로 붙여 칠 수 있는 명령 하나다. 셸 주소로 돌렸으면 --from-shell도 넣는다.
    assert.ok(
      shell.lines.some(line =>
        line.includes('pnpm --filter @vada/api db:migrate --from-shell --apply'),
      ),
      shell.lines.join(' | '),
    )
    noSecret(shell.lines)
    assert.equal(await publicTables(pg), 0)
  } finally {
    await pg.close()
  }
})

test('점검에 걸리면 --apply를 줘도 적용하지 않고, 연결은 닫는다', async () => {
  const pg = await PGlite.create()
  try {
    const stopped = async (setup: Setup, message: RegExp) => {
      const { calls, lines, run } = harness(pg, { args: ['--apply'], ...setup })
      assert.equal(await run(), 1, message.source)
      assert.deepEqual([calls.connect, calls.apply, calls.end], [1, 0, 1], message.source)
      assert.ok(
        lines.some(line => message.test(line)),
        `${message.source}: ${lines.join(' | ')}`,
      )
      assert.ok(lines.every(line => !line.includes('적용 완료')))
      noSecret(lines)
    }
    // 로컬 마이그레이션 시각이 커지는 순서가 아니다.
    await stopped(
      {
        readLocal: () => [
          { hash: 'a', folderMillis: 2 },
          { hash: 'b', folderMillis: 1 },
        ],
      },
      /시각이 커지는 순서가 아니다/,
    )
    // 기록이 없는데 표가 있다.
    await pg.exec('CREATE TABLE leftover (id int)')
    await stopped({}, /빈 DB가 아니므로/)
    // 옛 DB: 적용 기록 29줄.
    await pg.exec(
      'CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
    )
    for (let index = 1; index <= 29; index += 1)
      await pg.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [`old-${index}`, index * 1000],
      )
    await stopped({}, /순서나 해시가 다르다/)
  } finally {
    await pg.close()
  }
})

test('--apply는 빈 DB에 적용하고, 다시 읽은 기록 수로 실제 적용한 개수를 찍는다', async () => {
  const pg = await PGlite.create({ extensions: { btree_gist } })
  try {
    const first = harness(pg, { args: ['--apply'] })
    assert.equal(await first.run(), 0, first.lines.join(' | '))
    assert.deepEqual([first.calls.connect, first.calls.apply, first.calls.end], [1, 1, 1])
    assert.ok(
      first.lines.includes(`마이그레이션 적용 완료(${real.length}개)`),
      first.lines.join(' | '),
    )
    noSecret(first.lines)
    const again = harness(pg, { args: [] })
    assert.equal(await again.run(), 0)
    assert.ok(
      again.lines.some(line => line.includes('적용할 마이그레이션 0개')),
      again.lines.join(' | '),
    )
    assert.ok(
      again.lines.some(line => line.startsWith('public 표 65개, 적용 기록 ')),
      again.lines.join(' | '),
    )
  } finally {
    await pg.close()
  }
})

test('적용 호출이 아무것도 적용하지 않았으면 0개로 찍는다(적용할 개수를 그대로 찍지 않는다)', async () => {
  const pg = await PGlite.create()
  try {
    const { lines, calls, run } = harness(pg, { args: ['--apply'], apply: async () => {} })
    assert.equal(await run(), 0)
    assert.equal(calls.apply, 1)
    assert.ok(lines.includes('마이그레이션 적용 완료(0개)'), lines.join(' | '))
  } finally {
    await pg.close()
  }
})

test('적용 뒤 기록을 다시 읽다 실패하면 "마이그레이션 실패"가 아니라 적용은 끝났다고 따로 알리고 1로 끝난다', async () => {
  const pg = await PGlite.create({ extensions: { btree_gist } })
  try {
    let applied = false
    const { calls, lines, run } = harness(pg, {
      args: ['--apply'],
      apply: async () => {
        await migrate(drizzle(pg), { migrationsFolder })
        applied = true
      },
      query: async text => {
        if (applied)
          throw Object.assign(new Error(`secret ${URL_WITH_PASSWORD}`), { code: 'ECONNRESET' })
        return rowsOf(pg)(text)
      },
    })
    assert.equal(await run(), 1)
    assert.deepEqual([calls.apply, calls.end], [1, 1])
    assert.ok(
      lines.some(
        line => line.includes('적용은 끝났고 확인 읽기에 실패했다') && line.includes('미리 보기'),
      ),
      lines.join(' | '),
    )
    assert.ok(
      lines.some(line => line.includes('ECONNRESET')),
      lines.join(' | '),
    )
    assert.ok(
      lines.every(line => !line.includes('마이그레이션 실패') && !line.includes('적용 완료')),
    )
    noSecret(lines)
  } finally {
    await pg.close()
  }
})

test('--apply는 대상을 보여 줄 수 없으면 연결하기 전에 멈추고, 미리 보기는 그대로 보여 준다', async () => {
  const pg = await PGlite.create()
  try {
    // 비밀번호의 ?에서 주소가 잘려 호스트가 ss로 읽힌다.
    const unreadable = 'postgres://u:p@ss?word@host/db'
    const apply = harness(pg, { args: ['--apply'], readEnvUrl: () => unreadable })
    assert.equal(await apply.run(), 1)
    assert.deepEqual([apply.calls.readEnvUrl, apply.calls.connect, apply.calls.apply], [1, 0, 0])
    assert.ok(apply.lines.includes('대상: (주소를 읽지 못했다) (.env)'), apply.lines.join(' | '))
    assert.ok(
      apply.lines.some(line => line.includes('대상을 보여 줄 수 없어 적용하지 않는다')),
      apply.lines.join(' | '),
    )
    noSecret(apply.lines)
    assert.ok(apply.lines.every(line => !line.includes('ss') && !line.includes('word')))
    // 셸 주소도 같다.
    const shell = harness(pg, { args: ['--from-shell', '--apply'], shellUrl: unreadable })
    assert.equal(await shell.run(), 1)
    assert.deepEqual([shell.calls.connect, shell.calls.apply], [0, 0])
    // 미리 보기는 아무것도 바꾸지 않으므로 계속한다.
    const preview = harness(pg, { readEnvUrl: () => unreadable })
    assert.equal(await preview.run(), 0)
    assert.ok(
      preview.lines.includes('대상: (주소를 읽지 못했다) (.env)'),
      preview.lines.join(' | '),
    )
    assert.deepEqual([preview.calls.connect, preview.calls.apply], [1, 0])
  } finally {
    await pg.close()
  }
})

test('실패해도 연결은 닫고, 주소·비밀번호·오류 원문은 찍지 않는다', async () => {
  const pg = await PGlite.create()
  try {
    const leaky = Object.assign(new Error(`connect to ${URL_WITH_PASSWORD} failed`), {
      code: 'ECONNREFUSED',
    })
    const refused = harness(pg, {
      args: ['--apply'],
      query: async () => {
        throw leaky
      },
    })
    assert.equal(await refused.run(), 1)
    assert.deepEqual([refused.calls.apply, refused.calls.end], [0, 1])
    assert.ok(
      refused.lines.some(line => line.includes('ECONNREFUSED')),
      refused.lines.join(' | '),
    )
    noSecret(refused.lines)

    const noCode = harness(pg, {
      query: async () => {
        throw new Error(`password=secret ${URL_WITH_PASSWORD}`)
      },
    })
    assert.equal(await noCode.run(), 1)
    assert.equal(noCode.calls.end, 1)
    noSecret(noCode.lines)

    const failedApply = harness(pg, {
      args: ['--apply'],
      apply: async () => {
        throw new Error(`secret ${URL_WITH_PASSWORD}`)
      },
    })
    assert.equal(await failedApply.run(), 1)
    assert.deepEqual([failedApply.calls.apply, failedApply.calls.end], [1, 1])
    assert.ok(failedApply.lines.every(line => !line.includes('적용 완료')))
    noSecret(failedApply.lines)

    // 연결을 닫다 실패해도 결과는 그대로다.
    const closing = harness(pg, {
      end: async () => {
        throw new Error('secret')
      },
    })
    assert.equal(await closing.run(), 0)
    noSecret(closing.lines)
  } finally {
    await pg.close()
  }
})

test('.env에서 주소를 못 읽으면 연결하지 않고 실패한다', async () => {
  for (const readEnvUrl of [
    () => undefined,
    () => {
      throw new Error('ENOENT secret path')
    },
  ]) {
    const { calls, lines, run } = harness(undefined, { readEnvUrl })
    assert.equal(await run(), 1)
    assert.equal(calls.connect, 0)
    assert.equal(calls.end, 0)
    assert.ok(lines.length > 0)
    noSecret(lines)
  }
})
