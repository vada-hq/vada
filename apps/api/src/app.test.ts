import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createApp, type Deps } from './app.ts'
import { maskSecrets } from './audit.ts'
import type { AuditEntry } from './audit.ts'

// 서버가 명세대로 답하는가, 그리고 **명세 밖으로 새지 않는가.**

const CATALOG_OPENAPI = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../specs/figma/vada-wireframe/openapi.json', import.meta.url)),
    'utf-8',
  ),
)

function harness(over: Partial<Deps> = {}) {
  const written: AuditEntry[] = []
  const deps: Deps = {
    audit: {
      async write(entry) {
        written.push(entry)
      },
    },
    viewer: async () => ({ userId: 'U-01', orgId: 'ORG-01' }),
    read: {
      async organization() {
        return { name: '제12대 소프트웨어융합대학 학생회' }
      },
      async viewer() {
        return { name: '박해랑', role: '운영부 · 부원' }
      },
    },
    ...over,
  }
  return { app: createApp(deps), written }
}

describe('셸이 읽는 두 자리', () => {
  it('학생회 이름을 명세가 적은 조각으로 답한다', async () => {
    const { app } = harness()
    const res = await app.request('/api/shell/organization')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: '제12대 소프트웨어융합대학 학생회' })
  })

  // **서버가 완성해서 준다.** '운영부 · 부원'을 화면이 이어 붙이면 역할 이름의
  // 규칙이 화면에 박힌다 — 이 저장소가 줄곧 정해 온 것이 그것이다.
  it('보는 사람의 역할을 이어 붙인 글로 답한다', async () => {
    const { app } = harness()
    const res = await app.request('/api/shell/viewer')

    expect(await res.json()).toEqual({ name: '박해랑', role: '운영부 · 부원' })
  })

  it('로그인하지 않았으면 막는다', async () => {
    const { app } = harness({ viewer: async () => null })
    const res = await app.request('/api/shell/organization')

    expect(res.status).toBe(401)
  })

  // 없는 것을 빈 이름으로 대신하지 않는다. 조용한 대체를 하지 않는 것이 이
  // 저장소의 규칙이고 서버도 같은 규칙을 따른다.
  it('학생회를 못 찾으면 조용히 빈 이름을 주지 않는다', async () => {
    const { app } = harness({
      read: {
        async organization() {
          return null
        },
        async viewer() {
          return null
        },
      },
    })
    const res = await app.request('/api/shell/organization')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ message: '학생회를 찾지 못했습니다' })
  })
})

describe('법이 요구하는 기록', () => {
  // 지난 일은 소급해 남길 수 없다. 자리마다 손으로 부르면 언젠가 잊고,
  // 잊은 자리는 조용하다.
  it('요청마다 남는다', async () => {
    const { app, written } = harness()
    await app.request('/api/shell/viewer', {
      // 헤더는 ByteString이라 한글이 들어갈 수 없다. 실제 브라우저도 그렇다.
      headers: { 'user-agent': 'vada-test', 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
    })

    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      userId: 'U-01',
      orgId: 'ORG-01',
      action: 'GET /api/shell/viewer → 200',
      ip: '10.0.0.1',
      userAgent: 'vada-test',
    })
  })

  // **막힌 시도가 오히려 봐야 할 것이다.**
  it('막힌 요청도 남는다', async () => {
    const { app, written } = harness({ viewer: async () => null })
    await app.request('/api/shell/organization')

    expect(written[0]?.action).toBe('GET /api/shell/organization → 401')
    expect(written[0]?.userId).toBeNull()
  })

  // **누구의 정보를 다뤘는가.** 기준이 요구하는 것은 '누가 접속했나'만이 아니다 —
  // 이 자리가 비면 새어 나간 뒤에 누구의 것이 새었는지 알 수 없다.
  it('처리한 정보주체를 남긴다', async () => {
    const { app, written } = harness()
    await app.request('/api/shell/viewer')

    expect(written[0]).toMatchObject({ subjectType: 'user', subjectId: 'U-01' })
  })

  // 처음 쓴 미들웨어는 `await next()` **뒤에** 썼다. 터진 요청은 흔적 없이
  // 사라졌고, 그 사실은 아무도 몰랐다.
  //
  // 여기서 보는 것은 **기록이 남는가**이지 오류가 어디서 잡히는가가 아니다 —
  // Hono가 안에서 잡아 500으로 답하든 위로 던지든, 남지 않으면 없는 것과 같다.
  it('터져도 기록이 남는다', async () => {
    const { app, written } = harness({
      read: {
        async organization() {
          throw new Error('DB가 죽었다')
        },
        async viewer() {
          return null
        },
      },
    })

    const res = await app.request('/api/shell/organization')

    expect(res.status).toBe(500)
    expect(written, '터진 요청이 흔적 없이 사라지면 안 된다').toHaveLength(1)
    expect(written[0]?.action).toContain('/api/shell/organization')
  })
})

// **주소에 실린 비밀은 오래 남기지 않는다.**
//
// 공개 자리는 경로에 토큰을 싣고 그 값이 곧 열쇠다. 1년을 남기면 감사 기록이
// 새는 순간 그 토큰으로 남의 결과를 열 수 있다 — 무엇을 했는지는 남기고 무엇으로
// 했는지는 지운다.
describe('주소의 비밀 가리기', () => {
  it('공개 자리의 토큰을 지운다', () => {
    expect(maskSecrets('/api/public/attendance/A7K2M9/check-in')).toBe(
      '/api/public/attendance/*/check-in',
    )
    expect(maskSecrets('/api/public/surveys/SVY-4f2a91c7/applications')).toBe(
      '/api/public/surveys/*/applications',
    )
  })

  it('안쪽 자리는 건드리지 않는다', () => {
    // 로그인한 사람의 자리는 경로에 비밀이 실리지 않는다 — 무엇을 만졌는지가
    // 남아야 하므로 그대로 둔다.
    expect(maskSecrets('/api/ops/meetings/MTG-09/agendas')).toBe('/api/ops/meetings/MTG-09/agendas')
    expect(maskSecrets('/api/shell/viewer')).toBe('/api/shell/viewer')
  })
})

describe('명세 밖으로 새지 않는다', () => {
  // 서버가 카탈로그에 없는 자리를 열면 그것은 명세가 모르는 기능이다.
  // 명세만 읽는 사람은 그 존재를 알 길이 없고, 그 자리는 아무 검사도 받지 않는다.
  it('연 자리가 전부 카탈로그에 있다', () => {
    const { app } = harness()
    const served = app.getOpenAPIDocument({
      openapi: '3.0.3',
      info: { title: 'vada', version: '0.1.0' },
    })

    const stray: string[] = []
    for (const [path, item] of Object.entries(served.paths ?? {})) {
      if (path === '/openapi.json') continue
      for (const method of Object.keys(item as object)) {
        const known = (CATALOG_OPENAPI.paths as Record<string, Record<string, unknown>>)[path]
        if (known?.[method] === undefined) stray.push(`${method} ${path}`)
      }
    }
    expect(stray, '카탈로그에 없는 자리를 열었습니다').toEqual([])
  })

  // operationId를 카탈로그의 key와 같게 두면 둘을 짝지을 수 있다. 다르면
  // '같은 자리인가'를 경로로만 물어야 하고, 경로는 나중에 바뀐다.
  it('operationId가 카탈로그의 key와 같다', () => {
    const { app } = harness()
    const served = app.getOpenAPIDocument({
      openapi: '3.0.3',
      info: { title: 'vada', version: '0.1.0' },
    })

    const wrong: string[] = []
    for (const [path, item] of Object.entries(served.paths ?? {})) {
      if (path === '/openapi.json') continue
      for (const [method, operation] of Object.entries(item as Record<string, { operationId?: string }>)) {
        const known = (CATALOG_OPENAPI.paths as Record<string, Record<string, { operationId?: string }>>)[
          path
        ]?.[method]
        if (known !== undefined && known.operationId !== operation.operationId) {
          wrong.push(`${method} ${path}: 서버 '${operation.operationId}' ≠ 카탈로그 '${known.operationId}'`)
        }
      }
    }
    expect(wrong).toEqual([])
  })
})
