import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
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
import type { Viewer } from '../permissions.ts'
import { harness, matchesContract, viewer } from './testing.ts'

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
    // 운영 조직을 세울 행사들. **세우는 검사마다 하나씩 쓴다** — 한 행사를 두 검사가
    // 쓰면 앞의 것이 세운 조직을 뒤의 것이 보게 된다.
    { id: 'E-03', orgId: 'ORG-01', title: '2026 가을 축제' },
    { id: 'E-04', orgId: 'ORG-01', title: '2026 학술제' },
    { id: 'E-05', orgId: 'ORG-01', title: '2026 동아리 박람회' },
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
    // 부서도 책임자 자리도 없는 줄. 표는 이런 줄을 허락한다 — 미배정으로 세되
    // 줄이 없는 사람과 **같은 사실**이므로 한 번만 세어져야 한다.
    { id: 'ES-05', orgId: 'ORG-01', eventId: 'E-02', memberId: 'M-04' },
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

// ─── EVT-03B가 읽는 셋과 EVT-01·03B가 쓰는 둘 ───────────────────────────────
//
// **미배정은 '이 학생회 구성원 중 이 행사 조직에 자리가 없는 사람'이다.** 오른쪽
// 기둥의 제목이 '기본 조직 구성원'이고 명세가 `org.unassignedMembers와 같은 자리`라
// 적었다 — 부서 카드의 '＋ 구성원 추가'가 여기서 사람을 데려간다. 표에 줄이 없는
// 사람도, 줄은 있는데 부서도 책임자 자리도 없는 사람도 같은 사실이다.
//
// **세우는 것과 고치는 것은 다른 자리다.** 세우기는 처음 한 번이라 두 번째는 409이고,
// 고치기는 조직 전부를 보내 덮어쓴다(계약의 repeat). 둘 다 **기본 조직에는 손대지
// 않는다** — 그것이 두 표를 나눈 까닭이다.

const JSON_HEADERS = { 'content-type': 'application/json' }

const unassigned = (eventId = 'E-01') =>
  harness(db).request(`/api/ops/events/${eventId}/staff/unassigned`)
const deptLeaderCandidates = (departmentId: string, eventId = 'E-01') =>
  harness(db).request(
    `/api/ops/events/${eventId}/staff/departments/${departmentId}/leader-candidates`,
  )
const memberCandidates = (departmentId: string, eventId = 'E-01') =>
  harness(db).request(
    `/api/ops/events/${eventId}/staff/departments/${departmentId}/member-candidates`,
  )
// **이름표는 요청을 건너 하나로 센다.** 발판 하나마다 처음부터 세면 둘째 요청이 첫째가
// 만든 줄의 이름표를 다시 받아 표에서 부딪힌다 — 배포의 이름표는 난수라 이 일이 없다.
let made = 0
const writer = (who?: Viewer) =>
  harness(db, { newId: () => `N-${(made += 1)}`, ...(who === undefined ? {} : { who }) })
const setup = (eventId: string, body: unknown, who?: Viewer) =>
  writer(who).request(`/api/ops/events/${eventId}/staff`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
const save = (eventId: string, body: unknown, who?: Viewer) =>
  writer(who).request(`/api/ops/events/${eventId}/staff`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })

const names = (rows: Row[]) => rows.map((row) => row.name)
const tree = async (eventId: string) => (await (await staffDepartments(eventId)).json()) as Row[]
const branch = (rows: Row[], name: string) => {
  const found = rows.find((row) => row.name === name)
  if (found === undefined) throw new Error(`부서 '${name}'가 없습니다`)
  return { leaders: names(found.leaders as Row[]), members: names(found.members as Row[]) }
}

describe('미배정 구성원(event.staffUnassignedMembers)', () => {
  it('모두 자리가 있으면 비어 있다', async () => {
    expect(await (await unassigned()).json()).toEqual([])
  })

  // **줄이 없는 사람과 자리 없는 줄을 가진 사람이 같은 사실이다.** 정하늘은 E-02에
  // 부서도 책임자 자리도 없는 줄을 갖고 있다 — 한 번만 세어진다.
  it('조직이 없는 행사는 구성원 전부가 미배정이다', async () => {
    const rows = (await (await unassigned('E-02')).json()) as Row[]
    expect(names(rows)).toEqual(['김바다', '박해랑', '이윤슬', '정하늘'])
    expect(rows.find((row) => row.id === 'M-04')).toMatchObject({
      major: '학부 미등록',
      grade: '학년 미등록',
    })
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await unassigned('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(
      matchesContract('event.staffUnassignedMembers', await (await unassigned('E-02')).json()),
    ).toBe(true)
  })
})

describe('부서장 후보(event.staffDeptLeaderCandidates)', () => {
  // 좁힐 근거가 명세에 없으므로 책임자 후보와 같은 목록이다. 다만 **지금 그 부서의
  // 부서장인 사람은 고를 수 없다** — 이미 그 자리이기 때문이다(계약의 disabled).
  it('구성원 전부가 오고 지금 부서장은 고를 수 없다', async () => {
    const rows = (await (await deptLeaderCandidates('ED-01')).json()) as Row[]
    expect(rows.map((row) => row.label)).toEqual(['김바다', '박해랑', '이윤슬', '정하늘'])
    expect(rows.find((row) => row.value === 'M-02')).toMatchObject({ disabled: true })
    expect(rows.find((row) => row.value === 'M-03')).not.toHaveProperty('disabled')
  })

  // 남의 행사의 부서도, 없는 부서도 여기서는 없는 것이다.
  it('이 행사의 부서가 아니면 없다고 한다', async () => {
    expect((await deptLeaderCandidates('ED-01', 'E-02')).status).toBe(404)
    expect((await deptLeaderCandidates('ED-99')).status).toBe(404)
    expect((await deptLeaderCandidates('ED-01', 'E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(
      matchesContract(
        'event.staffDeptLeaderCandidates.options',
        await (await deptLeaderCandidates('ED-01')).json(),
      ),
    ).toBe(true)
  })
})

describe('부서원 후보(event.staffMemberCandidates)', () => {
  // **이미 그 부서에 있는 사람은 넣을 수 없다** — 부서장도 부원도.
  it('구성원 전부가 오고 이미 그 부서에 있는 사람은 고를 수 없다', async () => {
    const rows = (await (await memberCandidates('ED-01')).json()) as Row[]
    expect(rows.map((row) => row.label)).toEqual(['김바다', '박해랑', '이윤슬', '정하늘'])
    expect(rows.filter((row) => row.disabled === true).map((row) => row.value)).toEqual([
      'M-03',
      'M-02',
    ])
  })

  it('이 행사의 부서가 아니면 없다고 한다', async () => {
    expect((await memberCandidates('ED-01', 'E-02')).status).toBe(404)
    expect((await memberCandidates('ED-99')).status).toBe(404)
    expect((await memberCandidates('ED-01', 'E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(
      matchesContract(
        'event.staffMemberCandidates.options',
        await (await memberCandidates('ED-01')).json(),
      ),
    ).toBe(true)
  })
})

describe('운영 조직을 세운다(event.staff.setup)', () => {
  // **부서와 그 안의 사람은 그대로 베끼고, 고른 책임자는 뿌리에 둔다.** 한 사람은
  // 한 자리에만 있으므로 부서장이던 사람이 책임자가 되면 그 부서에서는 빠진다.
  it('기본 조직 불러오기는 부서·부원을 베끼고 책임자를 뿌리에 둔다', async () => {
    const res = await setup('E-03', { setupMode: 'copyBase', leaderId: 'M-02' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})

    const rows = await tree('E-03')
    expect(names(rows)).toEqual(['기획부', '홍보부'])
    expect(branch(rows, '기획부')).toEqual({ leaders: ['김바다'], members: ['박해랑'] })
    expect(rows[0]!.memberCountLabel).toBe('부원 1명')
    // 이윤슬은 홍보부의 부서장이었지만 이제 책임자다 — 홍보부에는 남지 않는다.
    expect(branch(rows, '홍보부')).toEqual({ leaders: [], members: [] })
    expect((await (await leaders('E-03')).json()) as Row[]).toMatchObject([
      { name: '이윤슬', roleLabel: '책임자', roleTone: 'yellow' },
    ])
    // 기본 조직에서 부서가 없던 사람은 여기서도 자리가 없다 — 오른쪽 기둥에 온다.
    expect(names((await (await unassigned('E-03')).json()) as Row[])).toEqual(['정하늘'])
  })

  // **다른 물건이다.** 베낀 뒤에도 기본 조직은 그대로다.
  it('기본 조직에는 손대지 않는다', async () => {
    const base = await db
      .select({ departmentId: members.departmentId, isLeader: members.isDepartmentLeader })
      .from(members)
      .where(and(eq(members.orgId, 'ORG-01'), eq(members.id, 'M-02')))
    expect(base).toEqual([{ departmentId: 'D-02', isLeader: true }])
  })

  // 계약이 conflict라 적었다 — '처음 세운다'이므로 이미 세워진 조직에는 쓸 수 없다.
  it('두 번 세울 수 없다', async () => {
    expect((await setup('E-03', { setupMode: 'empty', leaderId: 'M-01' })).status).toBe(409)
    expect(names(await tree('E-03'))).toEqual(['기획부', '홍보부'])
  })

  it('빈 조직은 책임자만 둔다', async () => {
    expect((await setup('E-04', { setupMode: 'empty', leaderId: 'M-03' })).status).toBe(200)
    expect(await tree('E-04')).toEqual([])
    expect(names((await (await leaders('E-04')).json()) as Row[])).toEqual(['박해랑'])
    expect(names((await (await unassigned('E-04')).json()) as Row[])).toEqual([
      '김바다',
      '이윤슬',
      '정하늘',
    ])
  })

  // **계약이 부서를 실어 오지 않는다.** setup의 몸통은 방식과 책임자뿐이고 고르는
  // 칸도 그려지지 않았다 — 부서 전체로 대신 세우면 '고르기 전'과 '전부 골랐다'가
  // 같아지므로 막는다.
  it('참여 부서만 선택은 고를 자리가 없어 막는다', async () => {
    const res = await setup('E-05', { setupMode: 'pickDepartments', leaderId: 'M-01' })
    expect(res.status).toBe(422)
    expect(await tree('E-05')).toEqual([])
    expect(await (await leaders('E-05')).json()).toEqual([])
  })

  it('없는 방식·없는 책임자·남의 사람은 막고 아무것도 만들지 않는다', async () => {
    expect((await setup('E-05', { setupMode: '아무거나', leaderId: 'M-01' })).status).toBe(422)
    expect((await setup('E-05', { setupMode: 'copyBase' })).status).toBe(422)
    expect((await setup('E-05', { setupMode: 'copyBase', leaderId: 'M-99' })).status).toBe(422)
    expect(await tree('E-05')).toEqual([])
    expect(await (await leaders('E-05')).json()).toEqual([])
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await setup('E-99', { setupMode: 'empty', leaderId: 'M-01' })).status).toBe(404)
  })

  // 권한 행렬의 event.staff — 회장단이 아니면 그 행사 조직의 관리자여야 한다. 이 발판은
  // 그 물음에 '아니다'라고 답하므로(events/testing.ts) 부원은 막힌다.
  it('회장단이 아니면 관리자여야 한다', async () => {
    const res = await setup('E-05', { setupMode: 'empty', leaderId: 'M-01' }, viewer('member'))
    expect(res.status).toBe(403)
  })
})

describe('운영 조직을 고친다(event.staff.save)', () => {
  // E-03은 위에서 기본 조직을 베껴 세웠다: 기획부[김바다·박해랑] · 홍보부[] · 책임자 이윤슬.
  const idsOf = async () => {
    const rows = await tree('E-03')
    return { plan: rows[0]!.id as string, promo: rows[1]!.id as string }
  }

  // **화면이 보내는 그 모양이다.** 계약의 네 칸은 마지막 조각이고, 되풀이되는 부서의
  // 칸은 `departments.<부서>.<칸>`으로 온다. 화면 안의 자리 이름(leaders·unassigned)도
  // 함께 실려 오지만 서버는 그것을 읽지 않는다 — 배치는 부서마다의 목록이 말한다.
  it('책임자·부서장·부원 배치를 통째로 덮어쓴다', async () => {
    const { plan, promo } = await idsOf()
    const body = {
      leaderId: 'M-01',
      newDepartmentName: '안전팀',
      [`departments.${plan}.members`]: 'M-03\nM-04',
      [`departments.${promo}.departmentLeaderId`]: 'M-02',
      leaders: 'M-01',
      unassigned: '',
    }
    const res = await save('E-03', body)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})

    const rows = await tree('E-03')
    expect(names(rows)).toEqual(['기획부', '홍보부', '안전팀'])
    // 김바다는 기획부장이었지만 이제 책임자다 — 한 사람은 한 자리에만 있다.
    expect(branch(rows, '기획부')).toEqual({ leaders: [], members: ['박해랑', '정하늘'] })
    expect(branch(rows, '홍보부')).toEqual({ leaders: ['이윤슬'], members: [] })
    expect(branch(rows, '안전팀')).toEqual({ leaders: [], members: [] })
    expect(names((await (await leaders('E-03')).json()) as Row[])).toEqual(['김바다'])
    expect(await (await unassigned('E-03')).json()).toEqual([])

    // 같은 것을 다시 보내면 같은 조직이 된다(계약의 overwrite) — 부서가 둘이 되지 않는다.
    expect((await save('E-03', body)).status).toBe(200)
    expect(names(await tree('E-03'))).toEqual(['기획부', '홍보부', '안전팀'])
  })

  // **자리를 잃으면 줄도 없다.** 미배정은 줄이 아니라 '자리 없음'이다.
  it('부서에서 빼면 미배정으로 돌아가고 줄이 남지 않는다', async () => {
    const { plan } = await idsOf()
    expect(
      (await save('E-03', { leaderId: 'M-01', [`departments.${plan}.members`]: 'M-03' })).status,
    ).toBe(200)
    expect(names((await (await unassigned('E-03')).json()) as Row[])).toEqual(['정하늘'])
    const left = await db
      .select({ id: eventStaffMembers.id })
      .from(eventStaffMembers)
      .where(and(eq(eventStaffMembers.eventId, 'E-03'), eq(eventStaffMembers.memberId, 'M-04')))
    expect(left).toEqual([])
  })

  it('구성원 추가 칸으로도 사람이 든다', async () => {
    const { promo } = await idsOf()
    expect(
      (
        await save('E-03', {
          leaderId: 'M-01',
          [`departments.${promo}.departmentMemberId`]: 'M-04',
        })
      ).status,
    ).toBe(200)
    expect(branch(await tree('E-03'), '홍보부')).toEqual({
      leaders: ['이윤슬'],
      members: ['정하늘'],
    })
    expect(await (await unassigned('E-03')).json()).toEqual([])
  })

  // 부서장은 부서마다 0명 또는 1명이다 — 새 부서장이 오면 앞의 부서장은 그 부서의 부원이 된다.
  it('부서장은 부서마다 한 사람이다', async () => {
    const { promo } = await idsOf()
    expect(
      (
        await save('E-03', {
          leaderId: 'M-01',
          [`departments.${promo}.departmentLeaderId`]: 'M-04',
        })
      ).status,
    ).toBe(200)
    expect(branch(await tree('E-03'), '홍보부')).toEqual({
      leaders: ['정하늘'],
      members: ['이윤슬'],
    })
  })

  it('기본 조직에는 영향을 주지 않는다', async () => {
    const base = await db
      .select({
        id: members.id,
        departmentId: members.departmentId,
        isLeader: members.isDepartmentLeader,
      })
      .from(members)
      .where(eq(members.orgId, 'ORG-01'))
      .orderBy(members.id)
    expect(base).toEqual([
      { id: 'M-01', departmentId: 'D-01', isLeader: true },
      { id: 'M-02', departmentId: 'D-02', isLeader: true },
      { id: 'M-03', departmentId: 'D-01', isLeader: false },
      { id: 'M-04', departmentId: null, isLeader: false },
    ])
    const baseDepartments = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.orgId, 'ORG-01'))
    expect(baseDepartments).toHaveLength(2)
  })

  it('받을 수 없는 것은 막고 아무것도 바꾸지 않는다', async () => {
    const { plan, promo } = await idsOf()
    const before = await tree('E-03')
    // 책임자 없이
    expect((await save('E-03', {})).status).toBe(422)
    // 이 행사에 없는 부서
    expect(
      (await save('E-03', { leaderId: 'M-01', 'departments.NOPE.members': 'M-03' })).status,
    ).toBe(422)
    // 남의 학생회 사람
    expect(
      (await save('E-03', { leaderId: 'M-01', [`departments.${plan}.members`]: 'M-99' })).status,
    ).toBe(422)
    // 한 사람이 두 부서에
    expect(
      (
        await save('E-03', {
          leaderId: 'M-01',
          [`departments.${plan}.members`]: 'M-03',
          [`departments.${promo}.members`]: 'M-03',
        })
      ).status,
    ).toBe(422)
    expect(await tree('E-03')).toEqual(before)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await save('E-99', { leaderId: 'M-01' })).status).toBe(404)
  })

  it('회장단이 아니면 관리자여야 한다', async () => {
    expect((await save('E-03', { leaderId: 'M-01' }, viewer('member'))).status).toBe(403)
  })
})
