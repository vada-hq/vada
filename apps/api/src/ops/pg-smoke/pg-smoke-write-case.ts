import { and, eq } from 'drizzle-orm'
import type { UpdateCouncilSettingsRequest } from '@vada/contracts'
import { updateSettings } from '../../councils/service.js'
import { department, departmentMembership } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { assignDepartment, createDepartment, updateDepartment } from '../../team/service.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  changer,
  createdCouncil,
  fail,
  inviteCodeOf,
  joined,
  memberIdOf,
  pass,
  versionsOf,
  withConnections,
  googleUser,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'

// 사례 1: 쓰기 길 -------------------------------------------------------------

const WRITE_SETTINGS: UpdateCouncilSettingsRequest = {
  name: '점검 학생회(고침)',
  unit: 'college',
  schoolName: 'VADA 점검 학교',
  titles: { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' },
}

const W = { president: 'smoke-w-president', member: 'smoke-w-member' }

type WriteIds = { councilId: string; planningId: string; placementId: string }

// 학생회 만들기, 부서 만들기, 이름 바꾸기, 부서 배정, 학생회 정보 저장을 차례로 한다.
async function writeThroughServices(db: Db, context: SmokeContext): Promise<WriteIds> {
  await googleUser(db, W.president)
  await googleUser(db, W.member)
  const councilId = await createdCouncil(db, context, W.president, '점검 학생회')
  const change = changer(db, context, { userId: W.president, councilId })
  await change('department.manage', (tx, actor) => createDepartment(tx, actor, '기획부'))
  const [planning] = await db
    .select({ id: department.id })
    .from(department)
    .where(and(eq(department.councilId, councilId), eq(department.name, '기획부')))
  if (!planning) throw new Error('Department missing')
  await change('department.manage', (tx, actor) =>
    updateDepartment(tx, actor, planning.id, { name: '기획국', role: null }),
  )
  await joined(db, context, W.member, await inviteCodeOf(db, councilId))
  const memberId = await memberIdOf(db, W.member)
  await change('member.manage', (tx, actor) =>
    assignDepartment(tx, actor, { memberId, departmentId: planning.id, rank: null }),
  )
  await change('council.update', (tx, actor) => updateSettings(tx, actor, WRITE_SETTINGS))
  const [placement] = await db
    .select({ id: departmentMembership.id })
    .from(departmentMembership)
    .where(
      and(
        eq(departmentMembership.memberId, memberId),
        eq(departmentMembership.departmentId, planning.id),
      ),
    )
  if (!placement) throw new Error('Placement missing')
  return { councilId, planningId: planning.id, placementId: placement.id }
}

// 기록마다 판 수(만들기 1 + 바꾼 횟수), 열린 판 하나(마지막), 마지막 판의 값을 본다.
async function writeVerdict(sql: SmokeConnection['sql'], ids: WriteIds) {
  const checks = [
    {
      label: '학생회',
      id: ids.councilId,
      count: 2,
      values: { name: WRITE_SETTINGS.name, president_title: WRITE_SETTINGS.titles.president },
    },
    { label: '부서', id: ids.planningId, count: 2, values: { name: '기획국' } },
    {
      label: '부서 소속',
      id: ids.placementId,
      count: 1,
      values: { department_id: ids.planningId, ends_at: null },
    },
  ]
  const problems: string[] = []
  const counts: string[] = []
  for (const check of checks) {
    const versions = await versionsOf(sql, check.id)
    counts.push(`${check.label} ${versions.count}`)
    if (versions.count !== check.count)
      problems.push(`${check.label} 판 ${versions.count}개(기대 ${check.count})`)
    if (versions.open !== 1 || !versions.lastOpen)
      problems.push(`${check.label} 열린 판이 마지막 하나가 아님`)
    for (const [key, value] of Object.entries(check.values))
      if (versions.last[key] !== value) problems.push(`${check.label} 마지막 판의 ${key} 불일치`)
  }
  return problems.length > 0
    ? fail(problems.join(', '))
    : pass(`판 수 ${counts.join(', ')}, 마지막 판의 값이 기대와 같다`)
}

export const writePathCase: SmokeCase = {
  name: '쓰기 길(학생회 만들기, 부서 만들기, 이름 바꾸기, 부서 배정, 학생회 정보 저장)',
  run: context =>
    withConnections(context, async open => {
      const { db, sql } = open()
      return await writeVerdict(sql, await writeThroughServices(db, context))
    }),
}
