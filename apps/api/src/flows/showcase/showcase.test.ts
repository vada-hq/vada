import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ApplicantsResponse,
  EventResponse,
  EventRoomsResponse,
  EventsResponse,
  FeePaymentsResponse,
  HomeResponse,
  MeetingsResponse,
  MessagePageResponse,
  PurchaseRequestsResponse,
  RegistrationFormsResponse,
  TasksResponse,
} from '@vada/contracts'
import { koreanDateOf } from '@vada/contracts'
import { createTestDb } from '../../db/test-db.js'
import { fakeStorage } from '../../test-support/storage.js'
import { createPerson, type Person } from '../people.js'
import { startFlow } from '../server.js'
import { SHOWCASE } from './content/index.js'
import { createCalendar } from './moment.js'
import { runShowcase, showcaseStart } from './run.js'

// 시연 학생회 시나리오를 PGlite로 끝까지 돌리고, 결과를 화면이 읽는 응답(GET)으로만 본다.
// 날짜가 돌리는 날 기준인지는 두 날짜로 돌려 본다. 둘째는 한국 새벽 1시라, 그날 아직 오지 않은 단계(신청, 입금 확인)를 돌리는 때 앞으로 당긴다.
const NOON_1030 = new Date('2026-10-30T03:00:00Z')
const DAWN_1118 = new Date('2026-11-17T16:00:00Z')

async function runAt(finalAt: Date) {
  const { db, close } = await createTestDb()
  // 올린 때를 시나리오 시각으로 둔다(증빙 붙이기가 올린 지 72시간 안인지 본다).
  const fake = fakeStorage(() => flow.driver.now())
  const flow = await startFlow(db, {
    start: showcaseStart(SHOWCASE, finalAt),
    scope: 'connection',
    storage: fake.storage,
  })
  const account = async (key: string, name: string) =>
    (await createPerson(flow, key, name, { googleLinked: true })).userId
  const accounts = {
    president: await account('president', '김바다'),
    financeHead: await account('finance', '황성욱'),
    planningHead: await account('planning', '백승훈'),
  }
  // 실패해도 DB를 닫는다(열린 PGlite가 시험 과정을 붙잡지 않게).
  const { councilId, people } = await runShowcase(flow, {
    content: SHOWCASE,
    council: { name: SHOWCASE.council.name, schoolName: SHOWCASE.council.schoolName },
    finalAt,
    accounts,
    uploadEvidence: key => fake.put(key),
  }).catch(async (error: unknown) => {
    await close()
    throw error
  })
  const as = (name: string): Person => people.get(name)!
  const get = async <T>(name: string, path: string) => {
    const response = await as(name).api.get(`/api/organizations/${councilId}${path}`)
    assert.equal(response.status, 200, path)
    return (await response.json()) as T
  }
  return { close, get, people, cal: createCalendar(koreanDateOf(finalAt)) }
}

type Run = Awaited<ReturnType<typeof runAt>>

async function eventIdOf(run: Run, name: string) {
  const { events } = await run.get<EventsResponse>('김바다', '/events')
  return events.find(item => item.name === name)!.id
}

async function checkHomes(run: Run) {
  const president = await run.get<HomeResponse>('김바다', '/home')
  assert.equal(president.kind, 'council')
  // ① 확인이 필요한 운영 상황: 오늘·내일 마감 업무와 곧 필요한 결재 대기
  const rows = president.councilBoard!.ops.rows.map(row => `${row.kind} ${row.title}`)
  for (const row of ['today 간식 수량 확정', 'tomorrow 홍보물 준비', 'approval 기말고사 간식 구매'])
    assert.ok(rows.includes(row), `${row} / ${rows.join(', ')}`)
  const planning = await run.get<HomeResponse>('백승훈', '/home')
  assert.equal(planning.kind, 'department')
  const lanes = planning.departmentBoard!.lanes.events.map(lane => lane.event.name)
  assert.ok(lanes.includes('새내기 배움터'), lanes.join(', '))
  // 기획부가 맡은 예산 항목은 간식비 하나라 그 이름과 금액이 한 줄로 나온다.
  assert.equal(planning.departmentBoard!.budget?.name, '간식비')
  assert.equal(planning.departmentBoard!.budget?.amount, 300_000)
}

async function checkPlanningRoom(run: Run) {
  const eventId = await eventIdOf(run, '새내기 배움터')
  const { rooms } = await run.get<EventRoomsResponse>('백승훈', `/events/${eventId}/rooms`)
  const room = rooms.find(item => item.type === 'department' && item.name === '기획부')!
  const page = await run.get<MessagePageResponse>('백승훈', `/rooms/${room.id}/messages`)
  assert.equal(page.messages.length, 9)
  assert.ok(page.messages.every(message => message.senderId !== null))
  assert.match(page.messages[0]!.body!, /^상품 예산은/)
  assert.equal(page.messages.at(-1)!.senderName, '백승훈')
}

async function checkRegistrations(run: Run) {
  const eventId = await eventIdOf(run, '새내기 배움터')
  const { forms } = await run.get<RegistrationFormsResponse>(
    '백승훈',
    `/events/${eventId}/registration-forms`,
  )
  const form = forms[0]!
  assert.equal(form.applicantCount, 20)
  assert.match(
    form.notice!,
    new RegExp(`${run.cal.text('{{D+102}}').replace(/[()]/g, '\\$&')}까지`),
  )
  const { applicants } = await run.get<ApplicantsResponse>(
    '백승훈',
    `/registration-forms/${form.id}/applicants`,
  )
  assert.equal(applicants.length, 20)
  assert.equal(applicants.filter(item => item.deposit.status === 'confirmed').length, 10)
  assert.equal(applicants.filter(item => item.appliedFee === 50_000).length, 6)
  const fees = await run.get<FeePaymentsResponse>('황성욱', '/fee-payments')
  assert.deepEqual(fees.periods, [
    { paidFrom: run.cal.dayOf('D-59'), paidUntil: run.cal.dayOf('D+121'), count: 14 },
  ])
}

async function checkPurchases(run: Run) {
  const { requests } = await run.get<PurchaseRequestsResponse>(
    '황성욱',
    '/purchase-requests?view=all',
  )
  const statusOf = (title: string) => requests.find(item => item.title === title)?.status
  assert.equal(statusOf('간식행사 과자 구입'), 'approved')
  assert.equal(statusOf('간식행사 즉석식품 구입'), 'approved')
  assert.equal(statusOf('새터 조별 레크레이션 상품 구매'), 'approved')
  assert.equal(statusOf('기말고사 간식 구매'), 'pending')
  const midterm = await run.get<EventResponse>(
    '김바다',
    `/events/${await eventIdOf(run, '중간고사 간식행사')}`,
  )
  assert.equal(midterm.event.status, 'completed')
}

// 날짜는 모두 돌리는 날 기준이다: 행사 날짜, 업무 마감, 회의 이름의 주.
async function checkDates(run: Run) {
  const { events } = await run.get<EventsResponse>('김바다', '/events')
  const freshmen = events.find(item => item.name === '새내기 배움터')!
  assert.equal(freshmen.startsAt, `${run.cal.dayOf('D+116')}T10:00`)
  const tasks = await run.get<TasksResponse>('김바다', '/tasks?view=mine')
  const notice = tasks.tasks.find(item => item.title === '학생회비 납부 현황 공지')!
  assert.equal(notice.dueDate, run.cal.dayOf('D0'))
  const { meetings } = await run.get<MeetingsResponse>('김바다', '/meetings')
  const weekly = meetings.find(item => item.title === run.cal.text('{{D-1 주}} 운영진 회의'))!
  assert.equal(weekly.minutesStatus, 'confirmed')
}

test('시연 학생회 시나리오가 끝까지 돌아 화면 응답에 시연 내용이 보인다', async () => {
  const run = await runAt(NOON_1030)
  try {
    assert.equal(
      run.cal.text('{{D-1 주}} · {{D+3 주}} · {{D+1}}'),
      '10월 5주 · 11월 1주 · 10월 31일 (토)',
    )
    await checkHomes(run)
    await checkPlanningRoom(run)
    await checkRegistrations(run)
    await checkPurchases(run)
    await checkDates(run)
  } finally {
    await run.close()
  }
})

test('다른 날 새벽에 돌려도 날짜가 그날 기준이고, 아직 오지 않은 오늘 단계는 돌리는 때 앞으로 당겨진다', async () => {
  const run = await runAt(DAWN_1118)
  try {
    assert.equal(run.cal.dayOf('D0'), '2026-11-18')
    assert.equal(run.cal.dayOf('D+116'), '2027-03-14')
    assert.equal(run.cal.text('{{D-1 주}}'), '11월 3주')
    await checkDates(run)
    await checkRegistrations(run)
    const home = await run.get<HomeResponse>('김바다', '/home')
    assert.equal(home.today, '2026-11-18')
  } finally {
    await run.close()
  }
})
