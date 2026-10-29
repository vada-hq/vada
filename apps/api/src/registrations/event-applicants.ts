import { and, count, eq, isNull } from 'drizzle-orm'
import {
  EVENT_APPLICANT_PAGE_SIZE,
  type EventApplicantsQuery,
  type EventApplicantsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { attendance, registration, registrationForm } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { eventRowOf } from '../events/queries.js'
import { recordApplicantAccess } from './access-log.js'
import { shownAnswersOf } from './answers.js'
import { duplicateStudentIds } from './applicants.js'
import { eventApplicantOf, eventApplicantRows } from './event-applicant-rows.js'
import { decideOnEvent, eventFactsOf, type EventFacts } from './policy.js'

type Target = {
  eventId: string
  ip: string
  now: Date
  query: EventApplicantsQuery
  access: () => { token: string; first: boolean }
}

async function countsOf(tx: Tx, eventId: string) {
  const base = and(eq(registrationForm.eventId, eventId), isNull(registration.cancelledAt))
  const [applicants] = await tx
    .select({ n: count() })
    .from(registration)
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .where(base)
  const [attended] = await tx
    .select({ n: count() })
    .from(attendance)
    .innerJoin(registration, eq(registration.id, attendance.registrationId))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .where(and(base, isNull(attendance.cancelledAt)))
  return { applicants: applicants!.n, attended: attended!.n }
}

async function visibleApplicants(tx: Tx, actor: Actor, target: Target, facts: EventFacts) {
  const forms = await tx
    .select({ id: registrationForm.id })
    .from(registrationForm)
    .where(eq(registrationForm.eventId, target.eventId))
    .orderBy(registrationForm.id)
  if (!forms.length) return {}
  const access = target.access()
  const duplicates = await duplicateStudentIds(tx, target.eventId)
  const scope = { eventId: target.eventId, query: target.query, duplicates, now: target.now }
  const [total] = await tx.select({ n: count() }).from(eventApplicantRows(tx, scope).as('filtered'))
  const rows = await eventApplicantRows(tx, scope)
    .limit(EVENT_APPLICANT_PAGE_SIZE)
    .offset((target.query.page - 1) * EVENT_APPLICANT_PAGE_SIZE)
  // 같은 토큰으로 쪽·검색을 바꾸면 다른 양식이 드러날 수 있어 응답마다 포함된 양식을 기록한다(DEC-65).
  for (const formId of new Set(rows.map(row => row.formId)))
    await recordApplicantAccess(tx, {
      actor,
      formId,
      registrationId: null,
      action: 'list',
      ip: target.ip,
    })
  // 답도 신청자 정보다. 위 열람 기록과 같은 거래에서 같은 쪽의 신청만 읽는다(DEC-56).
  const answers = await shownAnswersOf(tx, rows)
  return {
    applicants: rows.map(row => ({
      ...eventApplicantOf(row, actor, facts, duplicates),
      answers: answers.get(row.id)!,
    })),
    total: total!.n,
    showForm: forms.length > 1,
    accessToken: access.token,
  }
}

export async function eventApplicantsOf(
  tx: Tx,
  actor: Actor,
  target: Target,
): Promise<EventApplicantsResponse> {
  const event = await eventRowOf(tx, actor, target.eventId)
  const facts = await eventFactsOf(tx, actor, { eventId: event.id, eventOwnerId: event.ownerId })
  const canView = decideOnEvent(actor, facts, 'form.view_applicants') === null
  return {
    applicants: [],
    counts: await countsOf(tx, event.id),
    total: 0,
    page: target.query.page,
    canView,
    canManage: canView && decideOnEvent(actor, facts, 'form.check_in') === null,
    showAffiliation: false,
    showForm: false,
    accessToken: null,
    ...(canView ? await visibleApplicants(tx, actor, target, facts) : {}),
  }
}
