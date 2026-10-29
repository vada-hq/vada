import { and, count, eq, isNull } from 'drizzle-orm'
import { APPLICANT_LIST_LIMIT, type EventApplicantsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { attendance, registration, registrationForm } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { eventRowOf } from '../events/queries.js'
import { recordApplicantAccess } from './access-log.js'
import { shownAnswersOf } from './answers.js'
import { duplicateStudentIds } from './applicants.js'
import { eventApplicantOf, eventApplicantRows } from './event-applicant-rows.js'
import { decideOnEvent, eventFactsOf, type EventFacts } from './policy.js'

type Target = { eventId: string; ip: string; now: Date }

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
    .where(and(base, isNull(attendance.cancelledAt), eq(attendance.result, 'attended')))
  return { applicants: applicants!.n, attended: attended!.n }
}

async function visibleApplicants(tx: Tx, actor: Actor, target: Target, facts: EventFacts) {
  const forms = await tx
    .select({ id: registrationForm.id })
    .from(registrationForm)
    .where(eq(registrationForm.eventId, target.eventId))
    .orderBy(registrationForm.id)
  if (!forms.length) return {}
  const duplicates = await duplicateStudentIds(tx, target.eventId)
  const scope = { eventId: target.eventId, duplicates, now: target.now }
  // 명단은 한 번에 준다(상한 5,000명, 한 개 더 읽어 넘쳤는지 안다). 거르기·찾기·쪽 넘김은 화면이 해서
  // 한 번 읽을 때 응답에 실린 양식마다 열람 기록이 한 줄이다(DEC-93, DEC-65).
  const read = await eventApplicantRows(tx, scope).limit(APPLICANT_LIST_LIMIT + 1)
  const rows = read.slice(0, APPLICANT_LIST_LIMIT)
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
    truncated: read.length > APPLICANT_LIST_LIMIT,
    showForm: forms.length > 1,
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
    truncated: false,
    canView,
    canManage: canView && decideOnEvent(actor, facts, 'form.check_in') === null,
    showAffiliation: false,
    showForm: false,
    ...(canView ? await visibleApplicants(tx, actor, target, facts) : {}),
  }
}
