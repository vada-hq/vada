import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord } from '../records/records.js'
import { createTeamRoutes } from '../team/routes.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createHomeRoutes } from './routes.js'

// 2026-10-25 12:00 KST
const now = new Date('2026-10-25T03:00:00Z')

// 회장단 홈의 미배정 운영진 수(DEC-87, 와이어프레임 HOME-01C): 지금 기수에 끝나지 않은 학생회 소속이 있고,
// 학생회 직급이 없고, 이 기수에 열린 부서 소속이 없는 운영진이다.
test('미배정 수는 이 학생회의 직급·부서 없는 운영진만 센다. 배정하면 줄고, 부서에서 빼면 늘고, 내보내면 줄며, 회장단이 아니면 없다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await seedCouncil(db, pg, 's')
    // 다른 학생회는 같은 모양이다(직급·부서 없는 운영진 하나, 내보낸 운영진 하나). 학생회 거르기가 빠지면 수가 늘어난다.
    const o = await seedCouncil(db, pg, 'o')
    // 다른 학생회에서 부서가 있는 사람이 이 학생회에는 부서 없이 들어와 있다. 부서 소속의 기수 거르기가 빠지면 세지 않게 된다.
    const twoCouncils = o.people.financeMember
    await db.transaction(tx =>
      createRecord(tx, {
        kind: 'council_membership',
        councilId: s.councilId,
        actor: null,
        values: { memberId: twoCouncils.memberId, cohortId: s.cohortId, startsAt: clockNow },
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
    const read = async (user: string, councilId = s.councilId) => {
      const response = await api.get(`/api/organizations/${councilId}/home`, user)
      assert.equal(response.status, 200, user)
      return (await response.json()) as HomeResponse
    }
    const unassigned = async (user = 's-president') =>
      (await read(user)).councilBoard?.unassignedMembers

    // plain과 두 학생회에 든 사람. 회장·부회장, 부서원, 내보낸 사람, 다른 학생회 사람은 세지 않는다.
    assert.equal(await unassigned(), 2)
    assert.equal(await unassigned('s-vicePresident'), 2)
    assert.equal((await read('o-president', o.councilId)).councilBoard?.unassignedMembers, 1)

    const { plain, planningMember } = s.people
    const assign = await api.post(
      `${base}/members/${plain.memberId}/departments`,
      { departmentId: s.departments.planning, rank: null },
      's-president',
    )
    assert.equal(assign.status, 200)
    assert.equal(await unassigned(), 1)

    const removed = await api.post(
      `${base}/members/${planningMember.memberId}/departments/${s.departments.planning}/remove`,
      {},
      's-president',
    )
    assert.equal(removed.status, 200)
    assert.equal(await unassigned(), 2)

    const kicked = await api.post(
      `${base}/members/${twoCouncils.memberId}/remove`,
      {},
      's-president',
    )
    assert.equal(kicked.status, 200)
    assert.equal(await unassigned(), 1)

    // 회장단이 아니면 학생회 부분째 없다(부서 없는 운영진, 부서장, 부서원).
    for (const user of ['s-plain', 's-planningHead', 's-financeMember'])
      assert.equal((await read(user)).councilBoard, undefined, user)
    assert.equal((await api.get(`${base}/home`, 'o-president')).status, 403)
    assert.equal((await api.get(`${base}/home`)).status, 401)
  } finally {
    await close()
  }
})
