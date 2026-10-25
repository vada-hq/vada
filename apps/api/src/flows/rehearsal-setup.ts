import type { BudgetResponse, CreateCouncilRequest, TeamResponse } from '@vada/contracts'
import { DAY_MS } from '@vada/contracts'
import { enterCouncil } from './people.js'
import {
  create,
  koreanDay,
  nowOf,
  org,
  read,
  ROLES,
  seesPermission,
  write,
  type Ctx,
  type Role,
} from './rehearsal-kit.js'

const COHORT_BEFORE_DAYS = 60
const COHORT_AFTER_DAYS = 300
const PERIOD_BEFORE_DAYS = 30
const PERIOD_AFTER_DAYS = 200
const STANDING_BUDGET = 500_000

const BANK = { bank: '국민은행', holder: '학생회' }

// 준비 1: 회장이 학생회를 만들고 초대 코드를 읽는다. 화면에 동작이 있을 수 없는(학생회가 아직 없는) 유일한 쓰기다.
export async function createCouncilStep(ctx: Ctx) {
  const { chief } = ctx.cast
  const now = nowOf(ctx)
  const council: CreateCouncilRequest = {
    name: '리허설 학생회',
    unit: 'department',
    schoolName: '리허설 학교',
    cohortName: '리허설 기수',
    startsOn: koreanDay(new Date(now.getTime() - COHORT_BEFORE_DAYS * DAY_MS)),
    endsOn: koreanDay(new Date(ctx.finalAt.getTime() + COHORT_AFTER_DAYS * DAY_MS)),
  }
  const created = await create<{ council: { id: string } }>(
    chief,
    '/api/organizations/create',
    council,
    '학생회 만들기',
  )
  ctx.w.councilId = created.council.id
  const invite = await read<{ code: string }>(chief, `${org(ctx)}/invite`, '초대 코드 읽기')
  ctx.w.inviteCode = invite.code
}

const DEPARTMENTS = [
  { key: 'planning', name: '기획부' },
  { key: 'pr', name: '홍보부' },
] as const
// 부서 직급과 소속: [인물, 부서, 직급]. 재정부는 학생회를 만들 때 이미 있다.
const ASSIGNMENTS = [
  ['planHead', 'planning', 'head'],
  ['planner', 'planning', null],
  ['financeHead', 'finance', 'head'],
  ['financeStaff', 'finance', null],
  ['prHead', 'pr', 'head'],
] as const

// 준비 2: 인물이 초대 코드로 들어와 동의하고, 회장이 부서를 만들고 나눈다.
export async function joinPeopleStep(ctx: Ctx) {
  const { cast, w } = ctx
  for (const role of ROLES) if (role !== 'chief') await enterCouncil(cast[role], w.inviteCode)
  await seesPermission(ctx, cast.chief, 'department.manage')
  let team = await read<TeamResponse>(cast.chief, `${org(ctx)}/members`, '운영진 읽기')
  for (const { name } of DEPARTMENTS)
    team = await write<TeamResponse>(cast.chief, `${org(ctx)}/departments`, { name }, '부서 만들기')
  for (const role of ROLES) {
    const member = team.members.find(item => item.name === cast[role].name)
    if (!member) throw new Error(`운영진 목록에 ${cast[role].name}이 없다`)
    w.memberIds[role] = member.id
  }
  for (const { key, name } of DEPARTMENTS)
    w.departmentIds[key] = team.departments.find(item => item.name === name)!.id
  w.departmentIds.finance = team.departments.find(item => item.role === 'finance')!.id
  await seesPermission(ctx, cast.chief, 'member.manage')
  for (const [role, key, rank] of ASSIGNMENTS)
    await write<TeamResponse>(
      cast.chief,
      `${org(ctx)}/members/${w.memberIds[role as Role]}/departments`,
      { departmentId: w.departmentIds[key], rank },
      '부서 나누기',
    )
  await seesPermission(ctx, cast.chief, 'rank.manage')
  await write<TeamResponse>(
    cast.chief,
    `${org(ctx)}/members/${w.memberIds.vice}/rank`,
    { rank: 'vice_president' },
    '부회장 정하기',
  )
}

// 준비 3: 재정부장이 회계 기간, 상시 예산 항목, 대표 계좌와 참가비 계좌를 만든다. 행사용 예산 항목은 행사가 생긴 뒤(event 단계)에 만든다.
export async function financeBaseStep(ctx: Ctx) {
  const { financeHead } = ctx.cast
  const now = nowOf(ctx)
  await seesPermission(ctx, financeHead, 'finance.manage')
  const period = await create<BudgetResponse>(
    financeHead,
    `${org(ctx)}/fiscal-periods`,
    {
      name: '리허설 학기',
      startsOn: koreanDay(new Date(now.getTime() - PERIOD_BEFORE_DAYS * DAY_MS)),
      endsOn: koreanDay(new Date(ctx.finalAt.getTime() + PERIOD_AFTER_DAYS * DAY_MS)),
    },
    '회계 기간 만들기',
  )
  ctx.w.periodId = period.period!.id
  const standing = await create<BudgetResponse>(
    financeHead,
    `${org(ctx)}/budget-items`,
    { purpose: '상시 운영비', amount: STANDING_BUDGET, type: 'expense', eventId: null },
    '상시 예산 항목',
  )
  ctx.w.budgetItemIds.standing = standing.items.find(item => item.purpose === '상시 운영비')!.id
  for (const [key, name, type] of [
    ['main', '대표 계좌', 'main'],
    ['fee', '참가비 계좌', 'business'],
  ] as const) {
    const account = await create<{ account: { id: string } }>(
      financeHead,
      `${org(ctx)}/accounts`,
      { name, ...BANK, accountNumber: `123-456-${type === 'main' ? '000001' : '000002'}`, type },
      '계좌 만들기',
    )
    ctx.w.accountIds[key] = account.account.id
  }
}
