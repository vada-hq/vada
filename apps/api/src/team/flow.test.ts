import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  CreateCouncilResponse,
  InviteCodeResponse,
  MyCouncilsResponse,
  TeamResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'

// 바탕 spec '흐름(서버 통합)': 만들기 → 링크로 들어오기 → 부서 배정 → 내보내기 → 다시 들어오기 → 회장 넘기기
test('흐름: 판의 개수와 바꾼 사람, 단계마다의 DB 상태', async () => {
  const testDb = await createTestDb()
  const { pg, db } = testDb
  try {
    const clock = () => new Date('2026-10-19T03:00:00Z')
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        councils: createCouncilRoutes(db, testSession, clock),
        invites: createInviteRoutes(db, testSession, clock),
        team: createTeamRoutes(db, testSession, clock),
      }),
    )
    await addUser(pg, 'kim', { name: '김회장', email: 'kim@example.test' })
    await addUser(pg, 'lee', { name: '이운영', email: 'lee@example.test' })
    const memberOf = async (user: string) =>
      (
        await pg.query<{ member_id: string }>(
          'SELECT member_id FROM member_login WHERE user_id = $1',
          [user],
        )
      ).rows[0]?.member_id
    const versions = async (recordId: string) =>
      (
        await pg.query<{
          changed_by: string | null
          rank: string | null
          department_rank: string | null
          ended: boolean
        }>(
          `SELECT changed_by, data->>'council_rank' AS rank, data->>'department_rank' AS department_rank, data->>'ends_at' IS NOT NULL AS ended
       FROM record_version WHERE record_id = $1 ORDER BY version_no`,
          [recordId],
        )
      ).rows

    // 1. 학생회를 만든다.
    const { council } = (await (
      await api.post(
        '/api/organizations/create',
        {
          name: '컴퓨터학부 학생회',
          unit: 'department',
          schoolName: '한양대학교 ERICA',
          cohortName: '2026',
          startsOn: '2026-01-01',
          endsOn: '2026-12-31',
        },
        'kim',
      )
    ).json()) as CreateCouncilResponse
    const base = `/api/organizations/${council.id}`
    const kim = (await memberOf('kim'))!
    const { code } = (await (await api.get(`${base}/invite`, 'kim')).json()) as InviteCodeResponse

    // 2. 링크로 들어온다.
    assert.equal((await api.post('/api/organizations/join', { code }, 'lee')).status, 200)
    const lee = (await memberOf('lee'))!
    const [{ id: leeMembership }] = (
      await pg.query<{ id: string }>('SELECT id FROM council_membership WHERE member_id = $1', [
        lee,
      ])
    ).rows as [{ id: string }]
    assert.deepEqual(await versions(leeMembership), [
      { changed_by: lee, rank: null, department_rank: null, ended: false },
    ])

    // 3. 부서를 배정한다(재정부 부장). 부회장 직급도 준다. 내보냈다 다시 들어올 때 둘 다 돌아오지 않는 것을 보려는 것이다.
    const before = (await (await api.get(`${base}/members`, 'kim')).json()) as TeamResponse
    const finance = before.departments[0]!.id
    assert.equal(
      (
        await api.post(
          `${base}/members/${lee}/departments`,
          { departmentId: finance, rank: 'head' },
          'kim',
        )
      ).status,
      200,
    )
    assert.equal(
      (await api.post(`${base}/members/${lee}/rank`, { rank: 'vice_president' }, 'kim')).status,
      200,
    )
    const [{ id: placement }] = (
      await pg.query<{ id: string }>('SELECT id FROM department_membership WHERE member_id = $1', [
        lee,
      ])
    ).rows as [{ id: string }]

    // 4. 내보낸다. 내보낸 사람의 다음 요청은 403이다.
    assert.equal((await api.post(`${base}/members/${lee}/remove`, {}, 'kim')).status, 200)
    assert.equal((await api.get(base, 'lee')).status, 403)
    assert.equal((await api.get(`${base}/members`, 'lee')).status, 403)
    assert.deepEqual(
      (await (await api.get('/api/me/councils', 'lee')).json()) as MyCouncilsResponse,
      { councils: [] },
    )
    assert.deepEqual(
      (
        await pg.query(
          'SELECT ends_at IS NOT NULL AS ended FROM council_membership WHERE id = $1',
          [leeMembership],
        )
      ).rows,
      [{ ended: true }],
    )
    assert.deepEqual(
      (
        await pg.query(
          'SELECT ends_at IS NOT NULL AS ended FROM department_membership WHERE id = $1',
          [placement],
        )
      ).rows,
      [{ ended: true }],
    )

    // 5. 다시 들어온다. 같은 소속이 다시 열리고, 직급도 부서도 돌아오지 않는다(G4, DEC-47).
    assert.equal((await api.post('/api/organizations/join', { code }, 'lee')).status, 200)
    assert.equal((await api.get(base, 'lee')).status, 200)
    assert.deepEqual(
      (await pg.query('SELECT id FROM council_membership WHERE member_id = $1', [lee])).rows,
      [{ id: leeMembership }],
    )
    const rejoined = (await (await api.get(`${base}/members`, 'lee')).json()) as TeamResponse
    assert.deepEqual(
      rejoined.members.map(item => [item.name, item.councilRank, item.departments]),
      [
        ['김회장', 'president', []],
        ['이운영', null, []],
      ],
    )
    assert.equal(rejoined.departments[0]!.memberCount, 0)
    assert.equal(
      (
        await pg.query(
          'SELECT 1 FROM department_membership WHERE member_id = $1 AND ends_at IS NULL',
          [lee],
        )
      ).rows.length,
      0,
    )

    // 6. 회장을 넘긴다.
    const after = (await (
      await api.post(`${base}/president/transfer`, { memberId: lee }, 'kim')
    ).json()) as TeamResponse
    assert.deepEqual(
      after.members.map(item => [item.name, item.councilRank, item.departments]),
      [
        ['김회장', null, []],
        ['이운영', 'president', []],
      ],
    )

    // 판: 들어온 사람의 소속은 들어오기(본인) → 부회장 주기(회장) → 내보내기(회장) → 다시 들어오기(본인) → 회장 받기(넘긴 사람)
    assert.deepEqual(await versions(leeMembership), [
      { changed_by: lee, rank: null, department_rank: null, ended: false },
      { changed_by: kim, rank: 'vice_president', department_rank: null, ended: false },
      { changed_by: kim, rank: 'vice_president', department_rank: null, ended: true },
      { changed_by: lee, rank: null, department_rank: null, ended: false },
      { changed_by: kim, rank: 'president', department_rank: null, ended: false },
    ])
    const [{ id: kimMembership }] = (
      await pg.query<{ id: string }>('SELECT id FROM council_membership WHERE member_id = $1', [
        kim,
      ])
    ).rows as [{ id: string }]
    assert.deepEqual(await versions(kimMembership), [
      { changed_by: kim, rank: 'president', department_rank: null, ended: false },
      { changed_by: kim, rank: null, department_rank: null, ended: false },
    ])
    assert.deepEqual(await versions(placement), [
      { changed_by: kim, rank: null, department_rank: 'head', ended: false },
      { changed_by: kim, rank: null, department_rank: 'head', ended: true },
    ])
    // 판은 기록마다 이어진다. 지금 판은 하나다.
    assert.deepEqual(
      (
        await pg.query(
          `SELECT record_id FROM record_version WHERE upper(valid) IS NULL GROUP BY record_id HAVING count(*) > 1`,
        )
      ).rows,
      [],
    )
  } finally {
    await testDb.close()
  }
})
