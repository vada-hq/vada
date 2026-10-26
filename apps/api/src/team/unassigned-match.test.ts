import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isUnassignedMember, type HomeResponse, type TeamResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createHomeRoutes } from '../home/routes.js'
import { clockNow, createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'

const now = new Date('2026-10-25T03:00:00Z')

// 기능 023 정한 것 3: 조직 화면의 미배정 묶음(contracts isUnassignedMember)과 회장단 홈의 미배정 수(서버 쿼리)는
// 같은 자료에서 같은 수다. 다른 학생회는 같은 모양이고, 다른 학생회에서 부서가 있는 사람이 이 학생회에는 부서 없이 있다.
test('같은 자료에서 조직 화면의 미배정 줄 수와 홈의 미배정 수가 같다. 배정하거나 부서에서 빼도 함께 바뀐다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await seedCouncil(db, pg, 's')
    const o = await seedCouncil(db, pg, 'o')
    await db.transaction(tx =>
      createRecord(tx, {
        kind: 'council_membership',
        councilId: s.councilId,
        actor: null,
        values: {
          memberId: o.people.financeMember.memberId,
          cohortId: s.cohortId,
          startsAt: clockNow,
        },
      }),
    )
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        home: createHomeRoutes(db, testSession, { clock: () => now }),
        team: createTeamRoutes(db, testSession, () => now),
      }),
    )
    const base = `/api/organizations/${s.councilId}`
    const counts = async () => {
      const home = (await (await api.get(`${base}/home`, 's-president')).json()) as HomeResponse
      const team = (await (await api.get(`${base}/members`, 's-president')).json()) as TeamResponse
      return [home.councilBoard?.unassignedMembers, team.members.filter(isUnassignedMember).length]
    }
    assert.deepEqual(await counts(), [2, 2])
    const { plain, planningMember } = s.people
    assert.equal(
      (
        await api.post(
          `${base}/members/${plain.memberId}/departments`,
          { departmentId: s.departments.planning, rank: null },
          's-president',
        )
      ).status,
      200,
    )
    assert.deepEqual(await counts(), [1, 1])
    assert.equal(
      (
        await api.post(
          `${base}/members/${planningMember.memberId}/departments/${s.departments.planning}/remove`,
          {},
          's-president',
        )
      ).status,
      200,
    )
    assert.deepEqual(await counts(), [2, 2])
  } finally {
    await close()
  }
})
