import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { departments, events, members, organizations, tasks } from '../db/schema.ts'
import { harness, matchesContract, viewer } from './testing.ts'

// 행사를 끝내는 두 모달(EVT-02C · EVT-02E)이 읽는 것.
//
// **여기서 재는 것은 권한 판정이 아니라 그 판정을 적은 글이다.** 두 자리 모두
// 구성원이면 열린다(계약의 x-authorize가 member다) — 막는 것은 실제로 종료·완료를
// 하는 변이의 일이고, 이 자리는 **누가 할 수 있는지를 말해 주는** 자리다.
//
// 그 글에 역할 이름이 들어간다. 그래서 규칙은 한 곳(permissions.json)에서만 와야
// 한다 — 여기 손으로 적으면 행렬을 고칠 때 이 글만 옛말을 든 채 남는다.

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '학술체육부' })
  await db.insert(members).values({ id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair' })
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    // 남은 것이 하나도 없는 행사. 살펴 준 줄이 **아예 오지 않아야** 한다.
    { id: 'E-03', orgId: 'ORG-01', title: '2026 가을 축제' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])
  await db.insert(tasks).values([
    { id: 'T-01', orgId: 'ORG-01', eventId: 'E-01', title: '현수막 시안 확정', status: 'planned' },
    { id: 'T-02', orgId: 'ORG-01', eventId: 'E-01', title: '물품 구매 요청', status: 'inProgress' },
    { id: 'T-03', orgId: 'ORG-01', eventId: 'E-01', title: '안전 안내문 검토', status: 'review' },
    // 끝난 업무는 '미완료'가 아니다.
    { id: 'T-04', orgId: 'ORG-01', eventId: 'E-01', title: '운영 계획 확정', status: 'done' },
    // 다른 행사의 업무는 이 행사의 셈에 들지 않는다.
    { id: 'T-05', orgId: 'ORG-01', eventId: 'E-02', title: '남의 행사 업무', status: 'planned' },
  ])
})

afterAll(async () => {
  await close()
})

const endPermission = (eventId = 'E-01', who = viewer()) =>
  harness(db, { who }).request(`/api/ops/events/${eventId}/end-permission`)

const completeConfirm = (eventId = 'E-01', who = viewer()) =>
  harness(db, { who }).request(`/api/ops/events/${eventId}/complete-confirm`)

describe('행사 종료 권한 안내(EVT-02C)', () => {
  it('누가 할 수 있는지를 권한 행렬에서 만든 글로 준다', async () => {
    const body = (await (await endPermission()).json()) as Record<string, string>
    expect(body.title).toBe('이 행사를 종료할 권한이 없습니다')
    // **역할 이름은 명세가 갖는다**(org.baseRoles). 조건은 행렬의 딱지 그대로다.
    expect(body.note).toBe('행사 종료는 회장단 또는 부서장·부원(행사 조직만)만 할 수 있습니다.')
  })

  it('없는 행사는 없다고 한다', async () => {
    expect((await endPermission('E-없음')).status).toBe(404)
  })

  // **남의 학생회 행사는 여기서도 없는 것이다.**
  it('울타리를 넘지 않는다', async () => {
    expect((await endPermission('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    const body = await (await endPermission()).json()
    expect(matchesContract('event.endPermission', body)).toBe(true)
  })
})

describe('행사 완료 처리 확인(EVT-02E)', () => {
  // **막지 않는다** — 남은 것이 있어도 알려 줄 뿐이다.
  it('남은 업무를 세어 말한다', async () => {
    const body = (await (await completeConfirm()).json()) as Record<string, string>
    expect(body.warningNote).toBe('미완료 업무 3건')
    expect(body.warningTone).toBe('orange')
  })

  // **없으면 오지 않는다.** '미완료 업무 0건'을 주면 화면이 빈 경고 상자를 그린다.
  it('남은 것이 없으면 살펴 준 줄이 아예 오지 않는다', async () => {
    const body = (await (await completeConfirm('E-03')).json()) as Record<string, unknown>
    expect(body).not.toHaveProperty('warningNote')
    expect(body).not.toHaveProperty('warningTone')
  })

  it('누가 완료 처리할 수 있는지를 권한 행렬에서 만든 글로 준다', async () => {
    const body = (await (await completeConfirm()).json()) as Record<string, string>
    expect(body.permissionNote).toBe('행사 완료 처리는 회장단만 할 수 있습니다.')
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await completeConfirm('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    for (const eventId of ['E-01', 'E-03']) {
      const body = await (await completeConfirm(eventId)).json()
      expect(matchesContract('event.completeConfirm', body)).toBe(true)
    }
  })
})
