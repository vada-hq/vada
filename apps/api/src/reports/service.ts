import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { dDayOf, RETRO_SECTIONS, type ConfirmRetrospectiveRequest, type EventRecord, type EventReportFacts, type EventReportResponse,
  type EventSummary, type GenerateRetrospectiveRequest, type RecordEntry, type RecordsResponse, type RetrospectiveContent,
  type RetrospectiveItem, type RetrospectiveSource, type RetrospectiveView, type SaveRetrospectiveRequest } from '@vada/contracts'
import { chatRooms, departments, eventRetrospectives, memberships, messages, users } from '../db/schema.js'
import { eventSummaries, eventSummary } from '../events/events.js'
import { requireCompletedEvent } from '../events/lock.js'
import { ApiError } from '../http/errors.js'
import { factsByEvent } from './facts.js'
import { contentOf, type RetrospectiveGenerator, type RetrospectiveInput } from './generation.js'
import { kstDay, timelineOf, won } from './timeline.js'

type Db = PgDatabase<PgQueryResultHKT>
export type ReportDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<ReportDatabase['transaction']>[0]>[0]
type Row = typeof eventRetrospectives.$inferSelect
export interface ReportScope { organizationId: string; userId: string }
const generators = alias(users, 'retrospective_generators')
const confirmers = alias(users, 'retrospective_confirmers')
// 끼룩이에 보내는 대화는 최근 것부터 400개·40,000자까지다. 근거의 대화는 80자만 보인다.
const MESSAGE_LIMIT = 400
const MESSAGE_CHARACTERS = 40_000
const EXCERPT = 80

// 숫자 근거. 끼룩이에 보내는 글과 화면의 근거 칩이 같은 글이다.
function numbersOf(facts: EventReportFacts) {
  const numbers = [
    { id: 'fact:finance', text: facts.finance.budget === null ? `예산 미정 · 집행 ${won(facts.finance.spent)}`
      : `예산 ${won(facts.finance.budget)} → 집행 ${won(facts.finance.spent)}` },
    { id: 'fact:tasks', text: `업무 ${facts.tasks.total}건 중 ${facts.tasks.done}건 완료 · 지연 ${facts.tasks.late}건` },
    { id: 'fact:purchases', text: `구매 요청 ${facts.purchases.requested}건 · 승인 ${facts.purchases.approved}건` },
  ]
  return facts.registrations
    ? [{ id: 'fact:registrations', text: `신청 ${facts.registrations.registered}명 → 참석 ${facts.registrations.attended}명` }, ...numbers]
    : numbers
}
const excerptOf = (content: string) => [...content].length > EXCERPT ? `${[...content].slice(0, EXCERPT).join('')}…` : content

// 행사 대화: 최근 것부터 정한 만큼, 보낸 사람의 부서 이름과 함께. 사람 이름은 고르지 않는다.
async function conversationOf(db: Reader, organizationId: string, eventId: string) {
  const rows = await db.select({ id: messages.id, content: messages.content, createdAt: messages.createdAt, department: departments.name })
    .from(messages).innerJoin(chatRooms, eq(chatRooms.id, messages.chatRoomId))
    .leftJoin(memberships, and(eq(memberships.organizationId, chatRooms.organizationId), eq(memberships.userId, messages.authorId)))
    .leftJoin(departments, and(eq(departments.organizationId, memberships.organizationId), eq(departments.id, memberships.departmentId)))
    .where(and(eq(chatRooms.organizationId, organizationId), eq(chatRooms.eventId, eventId)))
    .orderBy(desc(messages.createdAt), desc(messages.id)).limit(MESSAGE_LIMIT)
  const chosen: typeof rows = []
  let characters = 0
  for (const row of rows) {
    if (characters + row.content.length > MESSAGE_CHARACTERS) break
    chosen.push(row)
    characters += row.content.length
  }
  return chosen.reverse()
}

async function inputOf(db: Reader, organizationId: string, event: EventSummary, facts: EventReportFacts, timeline: RecordEntry[]):
  Promise<RetrospectiveInput> {
  const eventDay = event.startsAt?.slice(0, 10) ?? null
  const dDay = (day: string) => eventDay ? dDayOf(day, eventDay) : null
  const talk = await conversationOf(db, organizationId, event.id)
  return {
    event: { name: event.name, startsOn: eventDay, endsOn: event.endsAt?.slice(0, 10) ?? null, place: event.place,
      department: event.ownerDepartment?.name ?? null },
    numbers: numbersOf(facts),
    records: timeline.map(entry => ({ id: entry.id, day: entry.day, dDay: dDay(entry.day), text: entry.text, note: entry.note })),
    messages: talk.map(row => {
      const day = kstDay(row.createdAt)
      return { id: `message:${row.id}`, day, dDay: dDay(day), department: row.department ?? null, content: row.content }
    }),
  }
}

// 회고를 화면 꼴로 바꾼다. 근거는 지금의 대화·준비 과정·숫자에서 찾고, 없으면 missing이다.
async function viewOf(db: Reader, organizationId: string, event: EventSummary, facts: EventReportFacts, timeline: RecordEntry[],
  row: { retro: Row; generatorName: string; confirmerName: string | null }): Promise<RetrospectiveView> {
  const { retro } = row
  const content = retro.content
  const items = [...RETRO_SECTIONS.flatMap(key => content[key]), ...content.questions]
  const messageIds = [...new Set(items.flatMap(item => item.sources).filter(id => id.startsWith('message:')).map(id => id.slice('message:'.length)))]
  const found = messageIds.length ? await db.select({ id: messages.id, content: messages.content, createdAt: messages.createdAt }).from(messages)
    .innerJoin(chatRooms, eq(chatRooms.id, messages.chatRoomId))
    .where(and(eq(chatRooms.organizationId, organizationId), eq(chatRooms.eventId, event.id), inArray(messages.id, messageIds))) : []
  const byMessage = new Map(found.map(message => [message.id, message]))
  const byEntry = new Map(timeline.map(entry => [entry.id, entry]))
  const byFact = new Map(numbersOf(facts).map(number => [number.id, number]))
  const source = (id: string): RetrospectiveSource => {
    if (id.startsWith('message:')) {
      const message = byMessage.get(id.slice('message:'.length))
      return message ? { kind: 'message', messageId: message.id, excerpt: excerptOf(message.content), at: message.createdAt.toISOString() }
        : { kind: 'missing' }
    }
    const fact = byFact.get(id)
    if (fact) return { kind: 'fact', id, text: fact.text }
    const entry = byEntry.get(id)
    return entry ? { kind: 'entry', id, text: entry.text, tab: entry.tab } : { kind: 'missing' }
  }
  const view = (item: RetrospectiveItem) => ({ id: item.id, text: item.text, sources: item.sources.map(source) })
  return {
    wentWell: content.wentWell.map(view), shortfalls: content.shortfalls.map(view), nextTime: content.nextTime.map(view),
    questions: content.questions.map(question => ({ ...view(question), answer: question.answer })),
    version: retro.version,
    generated: { by: { id: retro.generatedBy, name: row.generatorName }, at: retro.generatedAt.toISOString() },
    confirmed: retro.confirmedAt && retro.confirmedBy
      ? { by: { id: retro.confirmedBy, name: row.confirmerName ?? '' }, at: retro.confirmedAt.toISOString() } : null,
    stale: event.completedAt === null || retro.basedOnCompletedAt.toISOString() !== event.completedAt,
  }
}

// 응답 하나로 행사·숫자·준비 과정·회고를 준다. 바꾸는 요청도 같은 모양으로 돌려준다.
export async function reportResponse(db: Reader, organizationId: string, eventId: string): Promise<EventReportResponse> {
  const event = await eventSummary(db, organizationId, eventId)
  const facts = (await factsByEvent(db, organizationId, [event], new Date())).get(eventId)!
  const timeline = await timelineOf(db, organizationId, eventId)
  const [row] = await db.select({ retro: eventRetrospectives, generatorName: generators.name, confirmerName: confirmers.name })
    .from(eventRetrospectives)
    .innerJoin(generators, eq(generators.id, eventRetrospectives.generatedBy))
    .leftJoin(confirmers, eq(confirmers.id, eventRetrospectives.confirmedBy))
    .where(and(eq(eventRetrospectives.organizationId, organizationId), eq(eventRetrospectives.eventId, eventId)))
  return { event, facts, timeline, retrospective: row ? await viewOf(db, organizationId, event, facts, timeline, row) : null }
}

const where = (organizationId: string, eventId: string) =>
  and(eq(eventRetrospectives.organizationId, organizationId), eq(eventRetrospectives.eventId, eventId))
// 회고 행을 잠근다. 잠금 순서는 행사(requireCompletedEvent) → 회고다.
async function lockRetrospective(tx: Transaction, organizationId: string, eventId: string) {
  const [row] = await tx.select().from(eventRetrospectives).where(where(organizationId, eventId)).for('update')
  return row ?? null
}

// 고친 회고(spec 정책 9). 있던 문장은 ID로 찾아 근거를 잇고, 새 문장은 근거가 없다. 확인 필요는 더할 수 없고 지우거나 답한다.
function editedContent(current: RetrospectiveContent, input: SaveRetrospectiveRequest): RetrospectiveContent {
  const sentences = new Map(RETRO_SECTIONS.flatMap(key => current[key]).map(item => [item.id, item]))
  const questions = new Map(current.questions.map(question => [question.id, question]))
  const seen = new Set<string>()
  const use = (id: string) => {
    if (seen.has(id)) throw new ApiError('INVALID_INPUT', 400)
    seen.add(id)
  }
  const section = (list: SaveRetrospectiveRequest['wentWell']) => list.map(item => {
    if (item.id === null) return { id: randomUUID(), text: item.text, sources: [] }
    const before = sentences.get(item.id)
    if (!before) throw new ApiError('INVALID_INPUT', 400)
    use(item.id)
    return { id: item.id, text: item.text, sources: before.sources }
  })
  return {
    wentWell: section(input.wentWell), shortfalls: section(input.shortfalls), nextTime: section(input.nextTime),
    questions: input.questions.map(item => {
      const before = questions.get(item.id)
      if (!before) throw new ApiError('INVALID_INPUT', 400)
      use(item.id)
      return { ...before, answer: item.answer }
    }),
  }
}

export function createReportService(db: ReportDatabase, generate: RetrospectiveGenerator) {
  // 한 행사에서 한 번에 하나만 만든다(서버 하나 기준). 겹친 요청은 기다리지 않고 거절한다.
  const generating = new Set<string>()
  return {
    get: (scope: ReportScope, eventId: string) => reportResponse(db, scope.organizationId, eventId),
    // 완료한 행사, 최근 완료 순. 숫자는 지금 센 값이다.
    async records(scope: ReportScope): Promise<RecordsResponse> {
      const completed = (await eventSummaries(db, scope.organizationId)).filter(event => event.completedAt !== null)
        .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!) || b.id.localeCompare(a.id))
      if (!completed.length) return { records: [] }
      const rows = await db.select({ eventId: eventRetrospectives.eventId, confirmedAt: eventRetrospectives.confirmedAt }).from(eventRetrospectives)
        .where(and(eq(eventRetrospectives.organizationId, scope.organizationId), inArray(eventRetrospectives.eventId, completed.map(event => event.id))))
      const states = new Map(rows.map(row => [row.eventId, row.confirmedAt ? 'confirmed' as const : 'draft' as const]))
      const facts = await factsByEvent(db, scope.organizationId, completed, new Date())
      return { records: completed.map((event): EventRecord => ({ event, facts: facts.get(event.id)!, retrospective: states.get(event.id) ?? null })) }
    },
    // 끼룩이 초안을 만든다(처음이면 버전 0). 부르기 전과 저장할 때 완료 시각·버전을 보고, 그사이 바뀌었으면 결과를 버린다.
    async generate(scope: ReportScope, eventId: string, input: GenerateRetrospectiveRequest): Promise<EventReportResponse> {
      const event = await eventSummary(db, scope.organizationId, eventId)
      if (!event.completedAt) throw new ApiError('EVENT_NOT_COMPLETED', 409)
      const [current] = await db.select({ version: eventRetrospectives.version }).from(eventRetrospectives).where(where(scope.organizationId, eventId))
      if ((current?.version ?? 0) !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      if (generating.has(eventId)) throw new ApiError('GENERATION_IN_PROGRESS', 409)
      generating.add(eventId)
      try {
        const facts = (await factsByEvent(db, scope.organizationId, [event], new Date())).get(eventId)!
        const timeline = await timelineOf(db, scope.organizationId, eventId)
        const request = await inputOf(db, scope.organizationId, event, facts, timeline)
        let content: RetrospectiveContent
        try { content = contentOf(await generate(request), request) }
        catch (error) {
          if (error instanceof ApiError && error.status === 503) throw error
          throw new ApiError('GENERATION_FAILED', 502)
        }
        return await db.transaction(async tx => {
          const completedAt = await requireCompletedEvent(tx, scope.organizationId, eventId)
          if (completedAt.toISOString() !== event.completedAt) throw new ApiError('VERSION_CONFLICT', 409)
          const row = await lockRetrospective(tx, scope.organizationId, eventId)
          if ((row?.version ?? 0) !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
          const values = { content, basedOnCompletedAt: completedAt, generatedBy: scope.userId, generatedAt: sql`now()`, confirmedBy: null,
            confirmedAt: null }
          if (row) {
            await tx.update(eventRetrospectives).set({ ...values, version: row.version + 1 }).where(where(scope.organizationId, eventId))
          } else {
            const inserted = await tx.insert(eventRetrospectives).values({ eventId, organizationId: scope.organizationId, ...values })
              .onConflictDoNothing().returning({ eventId: eventRetrospectives.eventId })
            if (!inserted.length) throw new ApiError('VERSION_CONFLICT', 409)
          }
          return reportResponse(tx, scope.organizationId, eventId)
        })
      } finally { generating.delete(eventId) }
    },
    // 고쳐 저장한다. 저장한 사람이 확인한 것이다. 사람은 지금 기록을 보고 확인하므로 낡은 초안 표시도 지금 완료 시각으로 맞춘다.
    async save(scope: ReportScope, eventId: string, input: SaveRetrospectiveRequest): Promise<EventReportResponse> {
      return db.transaction(async tx => {
        const completedAt = await requireCompletedEvent(tx, scope.organizationId, eventId)
        const row = await lockRetrospective(tx, scope.organizationId, eventId)
        if (!row) throw new ApiError('INVALID_STATE', 409)
        if (row.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        await tx.update(eventRetrospectives).set({ content: editedContent(row.content, input), basedOnCompletedAt: completedAt, confirmedBy: scope.userId,
          confirmedAt: sql`now()`, version: row.version + 1 }).where(where(scope.organizationId, eventId))
        return reportResponse(tx, scope.organizationId, eventId)
      })
    },
    // 고치지 않고 확인한다. 저장과 같이 낡은 초안 표시를 지금 완료 시각으로 맞춘다.
    async confirm(scope: ReportScope, eventId: string, input: ConfirmRetrospectiveRequest): Promise<EventReportResponse> {
      return db.transaction(async tx => {
        const completedAt = await requireCompletedEvent(tx, scope.organizationId, eventId)
        const row = await lockRetrospective(tx, scope.organizationId, eventId)
        if (!row) throw new ApiError('INVALID_STATE', 409)
        if (row.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        if (row.confirmedAt) throw new ApiError('INVALID_STATE', 409)
        await tx.update(eventRetrospectives).set({ basedOnCompletedAt: completedAt, confirmedBy: scope.userId, confirmedAt: sql`now()`,
          version: row.version + 1 })
          .where(where(scope.organizationId, eventId))
        return reportResponse(tx, scope.organizationId, eventId)
      })
    },
  }
}
