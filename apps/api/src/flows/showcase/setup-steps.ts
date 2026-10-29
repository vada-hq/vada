import type { CreateCouncilRequest, TeamResponse } from '@vada/contracts'
import { koreanYearOf } from '@vada/contracts'
import { enterCouncil } from '../people.js'
import { create, read, write } from '../rehearsal-kit.js'
import type { StaffEntry } from './content/types.js'
import { myMemberId, org, seesPermission, who, type ShowcaseCtx } from './kit.js'

// 학생회와 운영진 준비: 회장이 학생회를 만들고, 운영진이 초대 코드로 들어오고, 회장이 부서와 직급을 나눈다.

const presidentOf = (ctx: ShowcaseCtx) => {
  const entry = ctx.content.council.staff.find(item => item.account === 'president')
  if (!entry) throw new Error('내용 파일의 운영진에 회장(account: president)이 없다')
  return who(ctx, entry.name)
}

// 회장이 학생회를 만든다. 재정 역할 부서는 이름만 주고 서버가 만든다. 운영 연도는 만드는 날의 해다(만들기 화면과 같다).
export async function createCouncilStep(ctx: ShowcaseCtx) {
  const president = presidentOf(ctx)
  const { departments } = ctx.content.council
  const finance = departments.find(item => item.finance)
  const body: CreateCouncilRequest = {
    unit: 'department',
    ...ctx.council,
    year: Number(koreanYearOf(ctx.flow.driver.now())),
    departments: departments.filter(item => !item.finance).map(item => item.name),
    ...(finance ? { financeDepartmentName: finance.name } : {}),
  }
  const created = await create<{ council: { id: string } }>(
    president,
    '/api/organizations/create',
    body,
    '학생회 만들기',
  )
  ctx.w.councilId = created.council.id
  ctx.w.inviteCode = (
    await read<{ code: string }>(president, `${org(ctx)}/invite`, '초대 코드')
  ).code
  president.memberId = await myMemberId(ctx, president)
  const team = await read<TeamResponse>(president, `${org(ctx)}/members`, '운영진 읽기')
  for (const item of team.departments) ctx.w.departments.set(item.name, item.id)
  await seesPermission(ctx, president, 'department.manage')
  for (const { name, color } of departments)
    await write(
      president,
      `${org(ctx)}/departments/${ctx.w.departments.get(name)}/color`,
      { color },
      `부서 색(${name})`,
    )
}

// 초대 코드로 들어온다. 가상 인물은 약관 동의 경로까지 지난다. 실제 계정은 이미 동의한 사람이라 동의를 대신 보내지 않는다.
export async function joinStep(ctx: ShowcaseCtx, entry: StaffEntry) {
  const person = who(ctx, entry.name)
  if (person.virtual) await enterCouncil(person, ctx.w.inviteCode)
  else await write(person, '/api/organizations/join', { code: ctx.w.inviteCode }, '초대로 들어오기')
  person.memberId = await myMemberId(ctx, person)
}

// 회장이 부서를 나누고 부장과 부회장을 정한다.
export async function assignStep(ctx: ShowcaseCtx) {
  const president = presidentOf(ctx)
  await seesPermission(ctx, president, 'member.manage')
  await seesPermission(ctx, president, 'rank.manage')
  for (const entry of ctx.content.council.staff) {
    const { memberId } = who(ctx, entry.name)
    if (entry.department)
      await write<TeamResponse>(
        president,
        `${org(ctx)}/members/${memberId}/departments`,
        {
          departmentId: ctx.w.departments.get(entry.department),
          rank: entry.head ? 'head' : null,
        },
        `부서 나누기(${entry.name})`,
      )
    if (entry.vicePresident)
      await write<TeamResponse>(
        president,
        `${org(ctx)}/members/${memberId}/rank`,
        { rank: 'vice_president' },
        `부회장 정하기(${entry.name})`,
      )
  }
}
