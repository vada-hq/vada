import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  events,
  eventStaffDepartments,
  eventStaffMembers,
  members,
  organizations,
} from '../db/schema.ts'
import { harness, matchesContract } from './testing.ts'

// 행사 운영 조직(EVT-01 · EVT-03A)이 읽는 것.
//
// **학생회의 기본 조직과 다른 물건이다.** 표도 둘이고(`event_staff_*`) 명세도
// 그렇게 못 박았다 — 같은 모양으로 그려지는 것과 같은 데이터인 것은 다른 말이다.
//
// 그래서 이 파일이 재는 첫째는 **두 조직이 안 섞이는 것**이다: 행사 조직에 아무도
// 없으면 기본 조직 사람이 대신 오지 않아야 하고, 미리보기는 반대로 **기본 조직에서**
// 와야 한다(아직 만들어지지 않은 것을 미리 보는 자리이므로).

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '홍보부', sortOrder: 1 },
  ])
  await db.insert(members).values([
    {
      id: 'M-01',
      orgId: 'ORG-01',
      name: '김바다',
      role: 'chair',
      major: '컴퓨터학부',
      grade: '3학년',
      departmentId: 'D-01',
      isDepartmentLeader: true,
    },
    {
      id: 'M-02',
      orgId: 'ORG-01',
      name: '이윤슬',
      role: 'head',
      major: 'ICT융합학부',
      grade: '4학년',
      departmentId: 'D-02',
      isDepartmentLeader: true,
    },
    {
      id: 'M-03',
      orgId: 'ORG-01',
      name: '박해랑',
      role: 'member',
      major: '컴퓨터학부',
      grade: '2학년',
      departmentId: 'D-01',
    },
    // 학부·학년을 아직 안 적은 사람. **빈 글이 아니라 그 사실이 와야 한다.**
    { id: 'M-04', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', role: 'chair' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    // 운영 조직을 아직 안 만든 행사(EVT-03C가 그리는 상태).
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])
  await db.insert(eventStaffDepartments).values([
    { id: 'ED-01', orgId: 'ORG-01', eventId: 'E-01', name: '운영팀', sortOrder: 0 },
    { id: 'ED-02', orgId: 'ORG-01', eventId: 'E-01', name: '홍보팀', sortOrder: 1 },
  ])
  await db.insert(eventStaffMembers).values([
    // 행사 책임자. 부서에 들지 않는다.
    {
      id: 'ES-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      memberId: 'M-01',
      isEventLeader: true,
      roleTitle: '총괄',
    },
    {
      id: 'ES-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      memberId: 'M-02',
      staffDepartmentId: 'ED-01',
      isDepartmentLeader: true,
    },
    {
      id: 'ES-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      memberId: 'M-03',
      staffDepartmentId: 'ED-01',
    },
    { id: 'ES-04', orgId: 'ORG-01', eventId: 'E-01', memberId: 'M-04', staffDepartmentId: 'ED-02' },
  ])
})

afterAll(async () => {
  await close()
})

const leaders = (eventId = 'E-01') =>
  harness(db).request(`/api/ops/events/${eventId}/staff/leaders`)
const staffDepartments = (eventId = 'E-01') =>
  harness(db).request(`/api/ops/events/${eventId}/staff/departments`)
const preview = (mode: string, eventId = 'E-01') =>
  harness(db).request(`/api/ops/events/${eventId}/staff/preview?setupMode=${mode}`)
const candidates = (eventId = 'E-01') =>
  harness(db).request(`/api/ops/events/${eventId}/staff/leader-candidates`)

type Row = Record<string, unknown>

describe('행사 책임자(event.staffLeaders)', () => {
  it('행사 조직의 책임자만 온다', async () => {
    const rows = (await (await leaders()).json()) as Row[]
    expect(rows.map((row) => row.name)).toEqual(['김바다'])
    expect(rows[0]).toMatchObject({
      major: '컴퓨터학부',
      grade: '3학년',
      // 이 행사에서 부르는 직함. 표가 든 것을 그대로 준다.
      roleLabel: '총괄',
      roleTone: 'yellow',
    })
  })

  // **없는 것을 기본 조직으로 메우지 않는다.** 회장단을 대신 주면 화면은 행사
  // 조직이 있는 줄 안다.
  it('행사 조직이 없으면 비어 있다', async () => {
    expect(await (await leaders('E-02')).json()).toEqual([])
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await leaders('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.staffLeaders', await (await leaders()).json())).toBe(true)
  })
})

describe('행사 운영 부서(event.staffDepartments)', () => {
  it('부서마다 부서장과 부원을 안고 온다', async () => {
    const rows = (await (await staffDepartments()).json()) as Row[]
    expect(rows.map((row) => row.name)).toEqual(['운영팀', '홍보팀'])
    expect(rows[0]).toMatchObject({ id: 'ED-01', memberCountLabel: '부원 1명' })
    expect((rows[0]!.leaders as Row[]).map((one) => one.name)).toEqual(['이윤슬'])
    expect((rows[0]!.members as Row[]).map((one) => one.name)).toEqual(['박해랑'])
  })

  // **없는 것을 빈 글로 대신하지 않는다.** 조직도가 쓰는 규칙과 같은 말이다.
  it('학부·학년을 안 적은 사람은 그 사실로 온다', async () => {
    const rows = (await (await staffDepartments()).json()) as Row[]
    expect((rows[1]!.members as Row[])[0]).toMatchObject({
      name: '정하늘',
      major: '학부 미등록',
      grade: '학년 미등록',
    })
  })

  it('행사 조직이 없으면 비어 있다', async () => {
    expect(await (await staffDepartments('E-02')).json()).toEqual([])
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await staffDepartments('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.staffDepartments', await (await staffDepartments()).json())).toBe(
      true,
    )
  })
})

describe('만들어질 조직 미리보기(event.staffSetupPreview)', () => {
  // **기본 조직에서 온다.** 아직 만들어지지 않은 것을 미리 보는 자리이므로 행사
  // 조직이 아니라 그 방식이 베낄 원본을 본다.
  it('기본 조직 불러오기는 학생회의 부서를 그대로 보여 준다', async () => {
    const rows = (await (await preview('copyBase')).json()) as Row[]
    expect(rows.map((row) => row.name)).toEqual(['기획부', '홍보부'])
    expect((rows[0]!.leaders as Row[]).map((one) => one.name)).toEqual(['김바다'])
    expect((rows[0]!.members as Row[]).map((one) => one.name)).toEqual(['박해랑'])
    expect(rows[0]!.memberCountLabel).toBe('부원 1명')
  })

  it('빈 조직은 만들어질 것이 없다', async () => {
    expect(await (await preview('empty')).json()).toEqual([])
  })

  // **안 넘긴 것과 틀리게 넘긴 것은 다르다.** 방식은 화면 안의 칸에 살아서 그릇이
  // 미리 받을 때는 아직 없다 — 그때 막으면 화면이 그려지기도 전에 통째로 오류가 된다.
  it('안 고르면 만들어질 것이 없고, 없는 방식은 막는다', async () => {
    const res = await harness(db).request('/api/ops/events/E-01/staff/preview')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect((await preview('아무거나')).status).toBe(422)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await preview('copyBase', 'E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.staffSetupPreview', await (await preview('copyBase')).json())).toBe(
      true,
    )
  })
})

describe('책임자 후보(event.staffLeaderCandidates)', () => {
  it('이 학생회의 구성원이 고를 수 있는 값으로 온다', async () => {
    const rows = (await (await candidates()).json()) as Row[]
    expect(rows.map((row) => row.label)).toEqual(['김바다', '박해랑', '이윤슬', '정하늘'])
    expect(rows[0]).toMatchObject({ value: 'M-01', description: '기획부' })
    // 부서가 없는 사람도 고를 수 있다. 그 사실이 곁의 글로 온다.
    expect(rows.find((row) => row.value === 'M-04')).toMatchObject({ description: '부서 미배정' })
    // 남의 학생회 사람은 없다.
    expect(rows.map((row) => row.value)).not.toContain('M-99')
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await candidates('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(
      matchesContract('event.staffLeaderCandidates.options', await (await candidates()).json()),
    ).toBe(true)
  })
})
