import { randomUUID } from 'node:crypto'
import type {
  PublicRegistrationForm,
  RegistrationForm,
  RegistrationFormsResponse,
} from '@vada/contracts'
import { CreateFormSchema, dateFromKorean } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import type { RateLimiter } from '../http/rate-limit.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { createPublicRegistrationRoutes } from '../registrations/public-routes.js'
import { createDepositRoutes } from '../deposits/routes.js'
import { createRegistrationRoutes } from '../registrations/routes.js'
import { seedCouncil } from './council.js'
import { caller, ORIGIN, testSession } from './http.js'

// 한국 시각 2026-10-25 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
const NOON = new Date('2026-10-25T03:00:00Z')
export const MISSING = '019e0000-0000-7000-8000-000000000000'
// 한국 시각 글자를 시각으로
export const korean = (value: string) =>
  new Date(`${value.length === 16 ? `${value}:00` : value}+09:00`)

// 공개 코드 형식(^[2-9A-HJ-NP-Z]{8}$)에 맞는 서로 다른 코드
let codes = 0
const nextCode = () => {
  const n = codes++
  return `AAAAA${'ABCDEFGH'[Math.floor(n / 64) % 8]}${'ABCDEFGH'[Math.floor(n / 8) % 8]}${'23456789'[n % 8]}`
}

export const FORM = { name: '가을 축제 신청', closesAt: '2026-11-01T18:00', collectsPhone: false }
type Values = Record<string, unknown>

// 학생회 둘(우리, 다른)과 양식 라우트(운영진, 공개)를 띄운다. clock은 시험이 움직일 수 있다.
export async function startRegistrations(options: { writeLimiter?: RateLimiter } = {}) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  let now = NOON
  const clock = () => now
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      registrations: createRegistrationRoutes(db, testSession, { clock, ...options }),
      deposits: createDepositRoutes(db, testSession, { clock, ...options }),
      publicRegistrations: createPublicRegistrationRoutes(db, {
        clock,
        receiptKey: 'test-receipt-key',
      }),
    }),
  )
  const orgBase = `/api/organizations/${council.councilId}`
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  const makeEvent = (values: Values = {}, owner: typeof council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { name: '가을 축제', ...values },
      }),
    )
  const makeTask = (eventId: string, departmentId: string | null, cancelled = false) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: {
          title: '현수막',
          eventId,
          departmentId,
          ...(cancelled ? { cancelledAt: clockNow } : {}),
        },
      }),
    )
  const makeAccount = (values: Values = {}, owner: typeof council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'account',
        councilId: owner.councilId,
        actor: owner.people.financeMember.memberId,
        values: {
          name: '대표',
          bank: '국민은행',
          accountNumber: '123-45-6789012',
          holder: '한양대 학생회',
          type: 'main',
          ...values,
        },
      }),
    )
  // 양식은 기록 모듈로 바로 만든다(권한 시험이 아닌 읽기 시험이 쓴다).
  const makeForm = (eventId: string, values: Values = {}, owner: typeof council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'registration_form',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: {
          eventId,
          name: '신청',
          closesAt: korean('2026-11-01T18:00'),
          publicCode: nextCode(),
          ...values,
        },
      }),
    )
  const makeRegistration = (formId: string, values: Values = {}, owner: typeof council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'registration',
        councilId: owner.councilId,
        actor: null,
        values: { formId, name: '김학생', appliedFee: '0', ...values },
      }),
    )
  // 납부자 명단 줄(재정부가 올린 것과 같은 기록)
  const makeFeePayment = (values: Values, owner: typeof council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'fee_payment',
        councilId: owner.councilId,
        actor: owner.people.financeMember.memberId,
        values: {
          studentId: '202612345',
          paidFrom: '2026-03-01',
          paidUntil: '2026-08-31',
          ...values,
        },
      }),
    )
  const attend = (registrationId: string, values: Values = {}) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'attendance',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: { registrationId, confirmedAt: clockNow, method: 'qr', ...values },
      }),
    )
  const change = (kind: 'registration' | 'account' | 'task', id: string, changes: Values) =>
    db.transaction(tx =>
      updateRecord(tx, {
        kind,
        id,
        actor: council.people.president.memberId,
        reason: null,
        changes,
      }),
    )
  // 행사를 완료한 것으로 만든다(완료 결재 한 줄).
  const complete = (eventId: string) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: {
          targetId: eventId,
          targetKind: 'event',
          outcome: 'completed',
          actorId: council.people.president.memberId,
          actorKind: 'member',
          actedAt: new Date('2026-10-24T03:00:00Z'),
          reason: null,
        },
      }),
    )
  const post = (path: string, body: unknown, user = 's-president') =>
    api.post(`${orgBase}${path}`, body, user)
  // 고치기는 지금 판을 함께 보낸다. 판을 따지지 않는 시험의 줄임이다. 없는 기록은 판 1로 보낸다.
  const editForm = async (formId: string, body: object, user = 's-president') => {
    const baseVersionNo = await count(
      'SELECT coalesce(max(version_no), 1) AS n FROM record_version WHERE record_id = $1',
      [formId],
    )
    return post(`/registration-forms/${formId}`, { ...body, baseVersionNo }, user)
  }
  const create = (eventId: string, body: unknown, user = 's-president') =>
    post(`/events/${eventId}/registration-forms`, body, user)
  const created = async (eventId: string, body: Values = {}, user = 's-president') => {
    const response = await create(eventId, { ...FORM, ...body }, user)
    return {
      status: response.status,
      form: ((await response.json()) as { form: RegistrationForm }).form,
    }
  }
  const detail = async (formId: string, user = 's-president') =>
    (
      (await (await api.get(`${orgBase}/registration-forms/${formId}`, user)).json()) as {
        form: RegistrationForm
      }
    ).form
  // 생성 API 시험과 기존 활성 양식을 읽는 시험을 가른다. 옛 활성 양식은 일시가 미정이어도 그대로 받는다.
  const activeForm = async (eventId: string, body: Values = {}) => {
    const {
      taskId: _task,
      questions: _questions,
      ...input
    } = CreateFormSchema.parse({ ...FORM, ...body })
    const id = await makeForm(eventId, {
      ...input,
      opensAt: input.opensAt ? dateFromKorean(input.opensAt) : null,
      closesAt: input.closesAt ? dateFromKorean(input.closesAt) : null,
      payerFee: input.payerFee === null ? null : String(input.payerFee),
      nonPayerFee: input.nonPayerFee === null ? null : String(input.nonPayerFee),
    })
    return { status: 201, form: await detail(id) }
  }
  const list = async (eventId: string, user = 's-president') =>
    (await (
      await api.get(`${orgBase}/events/${eventId}/registration-forms`, user)
    ).json()) as RegistrationFormsResponse
  const publicRead = async (code: string) => {
    const response = await api.get(`/api/public/registration-forms/${code}`)
    return { response, text: await response.text() }
  }
  const publicPost = (path: string, body: unknown) => api.post(`/api/public${path}`, body)
  // 명령 번호가 없는 객체 본문에는 새 번호를 달아 보낸다(기능 017). 번호 자체를 시험할 때는 publicPost로 직접 보낸다.
  const apply = (code: string, body: unknown) =>
    publicPost(
      `/registration-forms/${code}/apply`,
      typeof body === 'object' && body !== null && !('commandId' in body)
        ? { commandId: randomUUID(), ...body }
        : body,
    )
  // 신청해서 토큰을 받는다. 성공(201)이 아니면 던진다.
  const applied = async (code: string, body: unknown) => {
    const response = await apply(code, body)
    if (response.status !== 201) throw new Error(`신청이 ${response.status}로 끝났다`)
    return ((await response.json()) as { token: string }).token
  }
  const lookup = (token: string) => publicPost('/registrations/lookup', { token })
  const cancelMine = (token: string) => publicPost('/registrations/cancel', { token })
  const publicForm = async (code: string) =>
    JSON.parse((await publicRead(code)).text) as PublicRegistrationForm
  return {
    pg,
    db,
    council,
    other,
    api,
    orgBase,
    makeEvent,
    makeTask,
    makeAccount,
    makeForm,
    makeRegistration,
    makeFeePayment,
    attend,
    change,
    complete,
    post,
    editForm,
    create,
    created,
    activeForm,
    detail,
    list,
    publicRead,
    publicForm,
    publicPost,
    apply,
    applied,
    lookup,
    cancelMine,
    count,
    versions: (id: string) =>
      count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id]),
    setNow: (value: Date) => {
      now = value
    },
    close,
  }
}

export type RegistrationKit = Awaited<ReturnType<typeof startRegistrations>>

export const withRegistrations = (body: (t: RegistrationKit) => Promise<void>) => async () => {
  const t = await startRegistrations()
  try {
    await body(t)
  } finally {
    await t.close()
  }
}
