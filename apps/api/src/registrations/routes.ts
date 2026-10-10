import { Hono, type Context } from 'hono'
import { CancelRegistrationSchema, CheckInActionSchema, CheckInScanSchema, CreateRegistrationFormSchema, PaymentActionSchema, RegisterSchema, RegistrationTokenSchema, SetDuesMemberSchema, token,
  UpdateRegistrationFormSchema, type RegistrationResponse } from '@vada/contracts'
import { requireEventManager, requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createRegistrationService, type RegistrationDatabase, type RegistrationScope } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 공개 링크 코드는 초대 코드와 같은 형식이다. 형식이 틀린 코드와 없는 코드를 구분하지 않는다.
function codeOf(value: string | undefined) {
  if (!value || !/^[2-9A-HJ-NP-Z]{8}$/.test(value)) throw new ApiError('NOT_FOUND', 404)
  return value
}

// 행사 참가 신청. 신청자 정보가 있으므로 부서가 있는 구성원만 설정을 바꾸고 명단을 본다.
// 공개 경로(/public/...)는 로그인 없이 쓴다. 개인 링크 토큰은 경로가 아니라 본문으로 받아 접속 기록에 남지 않게 한다.
export function createRegistrationRoutes(db: RegistrationDatabase, session: SessionReader, { now = () => new Date() }: { now?: () => Date } = {}) {
  const routes = new Hono<MembershipEnv>()
  const service = createRegistrationService(db, now)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const manager = requireEventManager()
  const base = '/organizations/:organizationId/events/:eventId/registration'
  const scope = (c: Context<MembershipEnv>): RegistrationScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const eventId = (c: Context<MembershipEnv>) => idOf(c.req.param('eventId'))
  const reply = (body: RegistrationResponse) => body
  routes.get(base, auth, member, manager, async c => c.json(reply(await service.view(scope(c).organizationId, eventId(c)))))
  routes.post(base, json(CreateRegistrationFormSchema), auth, member, manager, async c =>
    c.json(reply(await service.create(scope(c), eventId(c), c.req.valid('json'))), 201))
  routes.patch(base, json(UpdateRegistrationFormSchema), auth, member, manager, async c =>
    c.json(reply(await service.update(scope(c), eventId(c), c.req.valid('json')))))
  routes.post(`${base}/entries/:registrationId/cancel`, json(CancelRegistrationSchema), auth, member, manager, async c =>
    c.json(reply(await service.cancel(scope(c), eventId(c), idOf(c.req.param('registrationId'))))))
  // 입금 확인·확인 취소·참가비 바꾸기
  routes.post(`${base}/entries/:registrationId/payment`, json(PaymentActionSchema), auth, member, manager, async c =>
    c.json(reply(await service.confirmPayment(scope(c), eventId(c), idOf(c.req.param('registrationId'))))))
  routes.post(`${base}/entries/:registrationId/payment/cancel`, json(PaymentActionSchema), auth, member, manager, async c =>
    c.json(reply(await service.cancelPayment(scope(c), eventId(c), idOf(c.req.param('registrationId'))))))
  routes.post(`${base}/entries/:registrationId/dues`, json(SetDuesMemberSchema), auth, member, manager, async c =>
    c.json(reply(await service.setDuesMember(scope(c), eventId(c), idOf(c.req.param('registrationId')), c.req.valid('json').duesMember))))
  // 참석 확인: QR로 찍기, 이름으로 확인, 확인 취소
  routes.post(`${base}/check-in`, json(CheckInScanSchema), auth, member, manager, async c =>
    c.json(await service.checkInByCode(scope(c), eventId(c), c.req.valid('json').code)))
  routes.post(`${base}/entries/:registrationId/check-in`, json(CheckInActionSchema), auth, member, manager, async c =>
    c.json(reply(await service.checkIn(scope(c), eventId(c), idOf(c.req.param('registrationId'))))))
  routes.post(`${base}/entries/:registrationId/check-in/cancel`, json(CheckInActionSchema), auth, member, manager, async c =>
    c.json(reply(await service.cancelCheckIn(scope(c), eventId(c), idOf(c.req.param('registrationId'))))))
  routes.get('/public/registration-forms/:code', async c => c.json(await service.publicForm(codeOf(c.req.param('code')))))
  routes.post('/public/registration-forms/:code/entries', json(RegisterSchema), async c =>
    c.json(await service.register(codeOf(c.req.param('code')), c.req.valid('json')), 201))
  routes.post('/public/registrations/lookup', json(RegistrationTokenSchema), async c => c.json(await service.lookup(c.req.valid('json').token)))
  routes.post('/public/registrations/cancel', json(RegistrationTokenSchema), async c => c.json(await service.cancelMine(c.req.valid('json').token)))
  return routes
}
