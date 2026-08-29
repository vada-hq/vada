import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { auditMiddleware, type AuditSink } from './audit.ts'

// 서버의 얼개.
//
// **자리와 모양은 명세가 정한다.** `specs/figma/vada-wireframe/`의 카탈로그가
// method·path·인자·조각·값의 종류를 이미 갖고 있고, `npm run openapi`가 그것을
// OpenAPI로 옮긴다. 여기서 하는 일은 그 자리에 답을 놓는 것뿐이다.
//
// 그래서 **여기서 만든 OpenAPI와 카탈로그에서 만든 OpenAPI가 같아야 한다.**
// Hono가 라우트에서 문서를 뽑아 주므로 둘을 견줄 수 있고, 견주는 검사가 있으면
// 서버가 명세 밖으로 새는 순간 빨간불이 된다.

declare module 'hono' {
  interface ContextVariableMap {
    userId: string | undefined
    orgId: string | undefined
    /**
     * 이 요청이 **누구의 정보를 다뤘는가.** 핸들러가 알려 주고 감사 기록이 남긴다.
     *
     * 기준이 요구하는 것은 '누가 접속했나'만이 아니라 '누구의 것을 다뤘나'다 —
     * 그 자리가 비면 새어 나간 뒤에 누구의 것이 새었는지 알 수 없다.
     */
    auditSubject: { type: string; id: string } | undefined
  }
}

export interface Deps {
  audit: AuditSink
  /** 지금 이 요청이 누구의 것인가. 인증이 붙기 전에는 밖에서 준다. */
  viewer: () => Promise<{ userId: string; orgId: string } | null>
  read: {
    organization(orgId: string): Promise<{ name: string } | null>
    viewer(orgId: string, userId: string): Promise<{ name: string; role: string } | null>
  }
}

const ErrorBody = z
  .object({ message: z.string() })
  .openapi('Error', { description: '사람에게 보일 글' })

/** 카탈로그의 messages.error가 그 출처의 실패를 무엇이라 말할지 이미 갖고 있다. */
function fail(message: string) {
  return { message }
}

export function createApp(deps: Deps) {
  const app = new OpenAPIHono()

  app.use('*', auditMiddleware(deps.audit))

  // 누구의 요청인지를 먼저 정한다. 밖에서 열리는 자리(/api/public/*)는 세션이
  // 없어도 되지만, 지금 만든 둘은 안쪽이라 없으면 막는다.
  app.use('/api/shell/*', async (c, next) => {
    const who = await deps.viewer()
    if (who === null) {
      return c.json(fail('로그인이 필요합니다'), 401)
    }
    c.set('userId', who.userId)
    c.set('orgId', who.orgId)
    await next()
  })

  const organization = createRoute({
    method: 'get',
    path: '/api/shell/organization',
    operationId: 'shell.organization',
    summary: '셸의 맨 위에 그려지는 학생회 이름',
    responses: {
      200: {
        description: '성공',
        content: {
          'application/json': {
            schema: z.object({ name: z.string().openapi({ description: '학생회 이름' }) }),
          },
        },
      },
      // **답할 수 있는 상태를 전부 적는다.** 안 적은 것으로 답하려 하면 타입이
      // 막는다 — 실제로 여기서 404를 빠뜨린 채 쓰다가 잡혔다. 문서에 없는 답을
      // 내놓으면 받는 쪽이 그것을 다룰 수 없다.
      401: { description: '로그인이 필요하다', content: { 'application/json': { schema: ErrorBody } } },
      404: { description: '그 학생회가 없다', content: { 'application/json': { schema: ErrorBody } } },
    },
  })

  app.openapi(organization, async (c) => {
    const orgId = c.get('orgId')!
    c.set('auditSubject', { type: 'organization', id: orgId })
    const row = await deps.read.organization(orgId)
    // 없는 것을 빈 이름으로 대신하지 않는다. 조용한 대체를 하지 않는 것이
    // 이 저장소의 규칙이고, 서버도 같은 규칙을 따른다.
    if (row === null) {
      return c.json(fail('학생회를 찾지 못했습니다'), 404)
    }
    return c.json({ name: row.name }, 200)
  })

  const viewer = createRoute({
    method: 'get',
    path: '/api/shell/viewer',
    operationId: 'shell.viewer',
    summary: '셸의 아래에 그려지는 지금 보는 사람',
    responses: {
      200: {
        description: '성공',
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().openapi({ description: '이름' }),
              // **서버가 완성해서 준다.** '운영부 · 부원'처럼 부서와 역할을 이미
              // 이어 붙인 글이다 — 화면이 역할 이름을 알면 그 규칙이 화면에 박힌다.
              role: z.string().openapi({ description: '부서와 역할을 이어 붙인 글' }),
            }),
          },
        },
      },
      401: { description: '로그인이 필요하다', content: { 'application/json': { schema: ErrorBody } } },
      403: { description: '이 학생회의 구성원이 아니다', content: { 'application/json': { schema: ErrorBody } } },
    },
  })

  app.openapi(viewer, async (c) => {
    const orgId = c.get('orgId')!
    const userId = c.get('userId')!
    // 보는 사람 자신의 학적 정보를 읽는다 — 그 사람이 정보주체다.
    c.set('auditSubject', { type: 'user', id: userId })
    const row = await deps.read.viewer(orgId, userId)
    if (row === null) {
      return c.json(fail('이 학생회의 구성원이 아닙니다'), 403)
    }
    return c.json(row, 200)
  })

  app.doc('/openapi.json', {
    openapi: '3.0.3',
    info: { title: 'vada', version: '0.1.0' },
  })

  return app
}
