import { Hono } from 'hono'
import { AssignDepartmentSchema, CreateDepartmentSchema, CreateOrganizationSchema, DeleteDepartmentSchema, UpdateDepartmentSchema,
  UpdateMemberTitleSchema, token, type CreateOrganizationResponse, type OrganizationMembersResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createOrganizationService, type OrganizationDatabase } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

export function createOrganizationRoutes(db: OrganizationDatabase, getSession: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const service = createOrganizationService(db)
  const auth = requireSession(getSession)
  const member = requireMembership(db)
  const root = '/organizations/:organizationId'
  routes.post('/organizations/create', json(CreateOrganizationSchema), auth, async c => {
    const membership = await service.create(c.get('userId'), c.req.valid('json'))
    return c.json({ membership } satisfies CreateOrganizationResponse, 201)
  })
  routes.get(`${root}/members`, auth, member, async c =>
    c.json(await service.list(c.req.param('organizationId'), c.get('userId')) satisfies OrganizationMembersResponse))
  routes.post(`${root}/departments`, json(CreateDepartmentSchema), auth, member, async c =>
    c.json(await service.createDepartment(c.req.param('organizationId'), c.get('userId'), c.req.valid('json').name)))
  routes.patch(`${root}/departments/:departmentId`, json(UpdateDepartmentSchema), auth, member, async c =>
    c.json(await service.updateDepartment(c.req.param('organizationId'), c.get('userId'), idOf(c.req.param('departmentId')), c.req.valid('json'))))
  routes.post(`${root}/departments/:departmentId/delete`, json(DeleteDepartmentSchema), auth, member, async c =>
    c.json(await service.deleteDepartment(c.req.param('organizationId'), c.get('userId'), idOf(c.req.param('departmentId')))))
  routes.post(`${root}/members/:membershipId/department`, json(AssignDepartmentSchema), auth, member, async c =>
    c.json(await service.assignDepartment(c.req.param('organizationId'), c.get('userId'), idOf(c.req.param('membershipId')),
      c.req.valid('json').departmentId)))
  routes.post(`${root}/members/:membershipId/title`, json(UpdateMemberTitleSchema), auth, member, async c =>
    c.json(await service.updateTitle(c.req.param('organizationId'), c.get('userId'), idOf(c.req.param('membershipId')), c.req.valid('json').title)))
  return routes
}
