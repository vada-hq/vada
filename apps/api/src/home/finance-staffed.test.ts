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

const now = new Date('2026-10-25T03:00:00Z')

test('financeStaffed는 현재 학생회 재정 부서의 유효한 구성원만 보고 배정·제거·역할 변경을 반영한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await seedCouncil(db, pg, 's')
    const o = await seedCouncil(db, pg, 'o')
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        home: createHomeRoutes(db, testSession, { clock: () => now }),
        team: createTeamRoutes(db, testSession, () => now),
      }),
    )
    const base = `/api/organizations/${s.councilId}`
    const read = async (user = 's-president', councilId = s.councilId) => {
      const response = await api.get(`/api/organizations/${councilId}/home`, user)
      assert.equal(response.status, 200)
      return (await response.json()) as HomeResponse
    }
    const staffed = async () => (await read()).councilBoard?.financeStaffed
    const post = async (path: string, body: object = {}) => {
      assert.equal((await api.post(`${base}${path}`, body, 's-president')).status, 200)
    }
    const finance = s.departments.finance
    const member = s.people.financeMember.memberId
    assert.equal(await staffed(), true)
    assert.equal((await read('s-vicePresident')).councilBoard?.financeStaffed, true)
    await post(`/members/${member}/departments/${finance}/remove`)
    assert.equal(await staffed(), false)
    // 다른 학생회의 재정부원과 이 학생회에서 재정 역할이 없는 부서원은 채워진 것으로 보지 않는다.
    assert.equal((await read('o-president', o.councilId)).councilBoard?.financeStaffed, true)
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
    assert.equal(await staffed(), false)
    await post(`/members/${member}/departments`, { departmentId: finance, rank: null })
    assert.equal(await staffed(), true)
    await post(`/departments/${finance}`, { name: '총무부', role: null })
    assert.equal(await staffed(), false)
    await post(`/departments/${finance}`, { name: '총무부', role: 'finance' })
    assert.equal(await staffed(), true)
    await post(`/members/${member}/remove`)
    assert.equal(await staffed(), false)
    for (const user of ['s-plain', 's-planningHead', 's-planningMember'])
      assert.equal((await read(user)).councilBoard, undefined)
    assert.equal((await api.get(`${base}/home`, 'o-president')).status, 403)
    assert.equal((await api.get(`${base}/home`)).status, 401)
  } finally {
    await close()
  }
})
