import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { freshDb } from '../db/testing.ts'
import { departments, members, organizations } from '../db/schema.ts'
import { permissionMatrix, roleAssignmentCount, roleAssignments, roleCounts } from './roles.ts'
import type { Db } from '../db/client.ts'

// **진짜 Postgres에 대고 잰다.** 흉내 낸 저장소로 재면 흉내가 틀린 곳을 영원히
// 못 본다 — 실제로 도는 것은 그 저장소가 아니기 때문이다.

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 소프트웨어융합대학 학생회' })
  await db.insert(organizations).values({ id: 'ORG-02', name: '옆 학생회' })
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '학술체육부' },
    { id: 'D-02', orgId: 'ORG-01', name: '기획부' },
  ])
  await db.insert(members).values([
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-01' },
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', departmentId: 'D-01' },
    { id: 'M-11', orgId: 'ORG-01', name: '이수현', role: 'head', departmentId: 'D-02' },
    // 부서에 아직 안 든 사람. org.unassignedMembers가 이들을 센다.
    { id: 'M-99', orgId: 'ORG-01', name: '한겨울', role: 'member', departmentId: null },
    // 다른 학생회 사람. 새어 나오면 안 된다.
    { id: 'M-50', orgId: 'ORG-02', name: '남의집', role: 'chair', departmentId: null },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('역할 및 권한이 읽는 것', () => {
  it('역할마다 몇인지 센다', async () => {
    expect(await roleCounts(db, 'ORG-01')).toEqual({ chairCount: 1, headCount: 1, memberCount: 2 })
  })

  // **남의 학생회가 새면 안 된다.** 모든 조회가 orgId로 갈리는지가 이 서비스의
  // 가장 기본적인 벽이고, 한 자리라도 빠뜨리면 조용히 샌다.
  it('다른 학생회는 세지 않는다', async () => {
    expect(await roleCounts(db, 'ORG-02')).toEqual({ chairCount: 1, headCount: 0, memberCount: 0 })
  })

  it('역할 이름과 색을 서버가 완성해서 준다', async () => {
    const rows = await roleAssignments(db, 'ORG-01')
    expect(rows[0]).toEqual({
      id: 'M-01',
      name: '김바다',
      department: '학술체육부',
      roleLabel: '회장단',
      roleTone: 'violet',
      role: 'chair',
    })
  })

  it('회장단·부서장·부원 차례로 준다', async () => {
    const rows = await roleAssignments(db, 'ORG-01')
    expect(rows.map((row) => row.role)).toEqual(['chair', 'head', 'member', 'member'])
  })

  // 조용한 대체를 하지 않는다 — 빈 글이 오면 화면은 부서가 없는 것과 이름이
  // 비어 있는 것을 갈라낼 수 없다.
  it('부서에 안 든 사람은 그 사실을 말로 준다', async () => {
    const rows = await roleAssignments(db, 'ORG-01')
    expect(rows.find((row) => row.id === 'M-99')?.department).toBe('소속 없음')
  })

  it('세는 말까지 서버가 만든다', async () => {
    expect(await roleAssignmentCount(db, 'ORG-01')).toEqual({ total: '4명' })
  })

  // **표는 정책의 그림이다.** 저장소에서 오지 않는다 — 행렬은 모든 학생회가 같다.
  it('권한 표를 정책에서 만든다', () => {
    const rows = permissionMatrix()
    expect(rows).toHaveLength(13)
    const finance = rows.find((row) => row.id === 'finance.manage')!
    expect(finance).toEqual({
      id: 'finance.manage',
      area: '예산 수정·구매 승인·증빙 처리',
      chair: '가능',
      chairTone: 'green',
      head: '재정부만',
      headTone: 'yellow',
      member: '재정부만',
      memberTone: 'yellow',
    })
    // 초대는 회장단만으로 정했다(2026-08-30). 그림은 '자기 부서만'을 그렸었다.
    const invite = rows.find((row) => row.id === 'org.invite')!
    expect([invite.chair, invite.head, invite.member]).toEqual(['가능', '—', '—'])
  })
})
