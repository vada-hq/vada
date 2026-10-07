import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { InviteCodeSchema, JoinOrganizationSchema, type InvitePreviewResponse, type JoinOrganizationResponse,
  type MembershipSummary, type MembershipsResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { memberships, organizations } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { queryMemberships, requireMembership, type MembershipEnv } from './membership.js'

export function createAccessRoutes(db: Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'insert'>, getSession: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const authenticated = requireSession(getSession)
  // 형식이 틀린 코드와 없는 코드를 구분하지 않는다. 둘 다 올바르지 않은 초대다.
  async function invitedOrganization(code: string) {
    const [organization] = await db.select({ id: organizations.id, name: organizations.name })
      .from(organizations).where(eq(organizations.inviteCode, code))
    if (!organization) throw new ApiError('NOT_FOUND', 404)
    return organization
  }

  routes.get('/me/memberships', authenticated, async (c) => {
    const result: MembershipSummary[] = await queryMemberships(db, c.get('userId'))
    return c.json({ memberships: result } satisfies MembershipsResponse)
  })
  routes.get('/organizations/:organizationId/membership', authenticated, requireMembership(db), (c) => {
    return c.json({ membership: c.get('membership') })
  })
  routes.get('/invites/:code', authenticated, async (c) => {
    const code = InviteCodeSchema.safeParse(c.req.param('code'))
    if (!code.success) throw new ApiError('NOT_FOUND', 404)
    const organization = await invitedOrganization(code.data)
    const [membership] = await queryMemberships(db, c.get('userId'), organization.id)
    return c.json({ organization, joined: membership !== undefined } satisfies InvitePreviewResponse)
  })
  // 와이어프레임 INV-01: 참여하면 미배정 구성원이 된다. 부서 편성은 ERD 재설계 때 정한다.
  routes.post('/organizations/join', json(JoinOrganizationSchema), authenticated, async (c) => {
    const organization = await invitedOrganization(c.req.valid('json').code)
    const userId = c.get('userId')
    // 이미 소속이면 아무것도 바꾸지 않는다. 동시에 와도 유일 제약이 소속을 하나로 지킨다.
    await db.insert(memberships).values({ id: randomUUID(), userId, organizationId: organization.id })
      .onConflictDoNothing({ target: [memberships.organizationId, memberships.userId] })
    const [membership] = await queryMemberships(db, userId, organization.id)
    if (!membership) throw new Error('Membership missing after join')
    return c.json({ membership } satisfies JoinOrganizationResponse)
  })
  return routes
}
