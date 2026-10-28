// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Action, ClosingAction, CouncilView } from '@vada/contracts'
import { budgetWithPeriod } from '@/test-support/budget-fixtures'
import { closingFixture } from '@/test-support/closing-fixtures'
import {
  councilView,
  FINANCE_PERMISSIONS,
  HEAD_PERMISSIONS,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  PRESIDENT_PERMISSIONS,
  teamResponse,
  type TeamViewer,
} from '@/test-support/council-fixtures'
import { COUNCIL_ID, FinanceAt } from '@/test-support/finance-at'
import { CURRENT_PERIOD, standardPeriods } from '@/test-support/income-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { overviewFixture } from '@/test-support/overview-fixtures'
import Organization from '@/team/Organization'
import { useTeam } from '@/team/useTeam'

// 역할 × 화면 읽기 행렬(권한 점검 2026-10-28, AGENTS.md '화면의 권한'): 같은 서버 응답을 다섯 역할의 권한으로 그려,
// 읽기 본문은 역할마다 같고 다른 것은 동작 버튼뿐임을 본다. 화면이 동작 권한이나 직급으로 읽기를 가리면 여기서 실패한다.
// 읽기 예외는 서버 권한 이름으로만 정한다(아래 READ_EXCEPTIONS).

type Role = {
  name: string
  permissions: Action[]
  councilRank: CouncilView['me']['councilRank']
  // 운영진 줄 동작은 서버가 읽는 사람마다 낸다(team/policy.ts). 읽기 칸은 같다.
  teamAs: TeamViewer
}
const ROLES: Role[] = [
  { name: '부원', permissions: MEMBER_PERMISSIONS, councilRank: null, teamAs: 'member' },
  { name: '부서장', permissions: HEAD_PERMISSIONS, councilRank: null, teamAs: 'member' },
  { name: '재정부', permissions: FINANCE_PERMISSIONS, councilRank: null, teamAs: 'member' },
  {
    name: '회장단',
    permissions: LEADER_PERMISSIONS,
    councilRank: 'vice_president',
    teamAs: 'leader',
  },
  {
    name: '회장',
    permissions: PRESIDENT_PERMISSIONS,
    councilRank: 'president',
    teamAs: 'president',
  },
]

// 읽기 예외: 서버 권한표의 읽기 이름과 그것이 여는 화면. 이 밖의 읽기는 모든 운영진이 같다(DEC-28).
const READ_EXCEPTIONS: Partial<Record<Action, string>> = {
  'closing.view_draft': '공개 전 결산서',
  'fee_payment.view': '납부자 명단 탭',
}

// 동작 버튼의 이름. 이것만 역할마다 달라도 된다.
const ACTION_LABELS = new Set<string>([
  '구매 요청 내기',
  '다시 열기',
  '공개',
  '공개용 엑셀',
  '감사용 엑셀',
  '증빙 묶음 받기',
  '예산 편성',
  '회계 기간 만들기',
  '구성원 초대',
  '부서 추가',
])
// 같은 읽기 링크인데 역할마다 이름만 다른 것: 총예산 카드의 예산 탭 링크는 재정부에게 '편성'이다(와이어프레임 FIN-00).
const SAME_LINK: Record<string, string> = { 편성: '내역' }

const textOf = (node: Node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()

// 읽기 본문: 버튼을 뺀 글과, 동작이 아닌 버튼(여는 곳)의 이름들. 묶음(section)의 차례는 배치라서
// (조직의 미배정 묶음은 회장단에게 맨 위, DEC-91) 묶음마다의 글을 차례 없이 견준다.
function readOf(root: Element) {
  const openers = [...root.querySelectorAll('button')]
    .map(button => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '')
    .map(name => SAME_LINK[name] ?? name)
    .filter(name => !ACTION_LABELS.has(name) && !name.endsWith(' 동작'))
  const clone = root.cloneNode(true) as Element
  for (const button of clone.querySelectorAll('button')) button.remove()
  const sections = [...clone.querySelectorAll('section')].filter(
    section => !section.parentElement?.closest('section'),
  )
  const groups = sections.map(textOf).sort()
  for (const section of sections) section.remove()
  // 여는 버튼은 개수까지 견준다(같은 이름의 링크 하나가 한 역할에서만 빠지면 잡는다).
  return { text: textOf(clone), groups, openers: openers.sort() }
}

const viewOf = (role: Role) =>
  councilView(COUNCIL_ID, { permissions: role.permissions, councilRank: role.councilRank })

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const ORG = `/api/organizations/${COUNCIL_ID}`
const PERIODS = `${ORG}/fiscal-periods`

function serveFinance(
  role: Role,
  periods = standardPeriods(),
  status: 'draft' | 'published' = 'published',
) {
  const api = mockApi()
  api.on('GET', `${ORG}/purchase-requests?view=mine`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', PERIODS, () => json(periods))
  api.on('GET', `${ORG}/finance-overview?period=${CURRENT_PERIOD}`, () =>
    json({ overview: overviewFixture() }),
  )
  api.on('GET', `${ORG}/budget`, () => json(budgetWithPeriod()))
  // 결산서. 동작은 서버가 역할마다 낸다(closing/queries.ts actionsOf).
  const closingActions: ClosingAction[] = role.permissions.includes('finance.manage')
    ? ['closing.export_public', 'closing.export_audit']
    : ['closing.export_public']
  api.on('GET', `${PERIODS}/${CURRENT_PERIOD}/closing`, () =>
    json({
      closing: closingFixture({
        status,
        publishedAt: status === 'published' ? '2026-10-20T05:03:00.000Z' : null,
        actions: closingActions,
      }),
    }),
  )
  return api
}

async function financeTab(role: Role, tab: string, ready: string) {
  window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=requests`)
  render(<FinanceAt view={viewOf(role)} onForbidden={vi.fn()} />)
  fireEvent.click(screen.getByRole('tab', { name: tab }))
  await screen.findByText(ready)
  return readOf(screen.getByRole('tabpanel'))
}

async function budget(role: Role) {
  await financeTab(role, '예산 현황', '예산 항목별 현황')
  fireEvent.click(screen.getByRole('button', { name: '항목 보기' }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('행사 홍보')
  const body = dialog.cloneNode(true) as Element
  // 창 제목은 재정부에게 '예산 편성', 다른 운영진에게 '예산 항목'이다. 그 아래 읽기 본문은 같다.
  body.querySelector('h2')?.remove()
  return readOf(body)
}

function OrganizationAt({ role }: { role: Role }) {
  const team = useTeam(COUNCIL_ID, () => {})
  return (
    <Organization
      view={viewOf(role)}
      reading={{ own: false }}
      team={team}
      onCouncilChanged={() => {}}
      onOwnChange={() => {}}
    />
  )
}

async function organization(role: Role) {
  const api = mockApi()
  api.on('GET', `${ORG}/members`, () => json(teamResponse(role.teamAs)))
  render(<OrganizationAt role={role} />)
  await screen.findByRole('heading', { name: '회장단' })
  await screen.findByText('박새내')
  return readOf(document.body)
}

const published = () => {
  const periods = standardPeriods()
  periods.periods[0] = { ...periods.periods[0]!, status: 'published' }
  return periods
}

const SCREENS: { name: string; read: (role: Role) => Promise<ReturnType<typeof readOf>> }[] = [
  {
    name: '재정 개요',
    read: role => (serveFinance(role), financeTab(role, '예산 현황', '예산 항목별 현황')),
  },
  {
    name: '예산',
    read: role => (serveFinance(role), budget(role)),
  },
  {
    name: '공개된 결산',
    read: role => (serveFinance(role, published()), financeTab(role, '결산', '공개됨')),
  },
  { name: '조직', read: organization },
]

describe('역할 × 화면 읽기 행렬: 읽기 본문은 역할마다 같고 동작 버튼만 다르다', () => {
  for (const { name, read } of SCREENS)
    test(name, async () => {
      const reads = []
      for (const role of ROLES) {
        reads.push({ role: role.name, ...(await read(role)) })
        cleanup()
        await resetAddress()
      }
      const [first, ...rest] = reads
      expect(first!.text.length + first!.groups.length, name).toBeGreaterThan(0)
      for (const other of rest) {
        expect(other.text, `${name}: ${other.role}의 읽기 글이 ${first!.role}와 다르다`).toBe(
          first!.text,
        )
        expect(other.groups, `${name}: ${other.role}의 묶음 글이 ${first!.role}와 다르다`).toEqual(
          first!.groups,
        )
        expect(
          other.openers,
          `${name}: ${other.role}의 여는 버튼이 ${first!.role}와 다르다`,
        ).toEqual(first!.openers)
      }
    })

  test('공개 전 결산서는 읽기 예외 closing.view_draft를 가진 역할만 읽는다', async () => {
    expect(READ_EXCEPTIONS['closing.view_draft']).toBe('공개 전 결산서')
    for (const role of ROLES) {
      serveFinance(role, standardPeriods(), 'draft')
      window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=closing`)
      render(<FinanceAt view={viewOf(role)} onForbidden={vi.fn()} />)
      const reads = role.permissions.includes('closing.view_draft')
      if (reads) expect(await screen.findByText('작성 중'), role.name).toBeTruthy()
      else expect(await screen.findByText('결산이 공개되면 보여요.'), role.name).toBeTruthy()
      cleanup()
      await resetAddress()
    }
  })

  test('납부자 명단 탭은 읽기 예외 fee_payment.view를 가진 역할에게만 있다', async () => {
    expect(READ_EXCEPTIONS['fee_payment.view']).toBe('납부자 명단 탭')
    for (const role of ROLES) {
      serveFinance(role)
      window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=requests`)
      render(<FinanceAt view={viewOf(role)} onForbidden={vi.fn()} />)
      expect(!!screen.queryByRole('tab', { name: '납부자 명단' }), role.name).toBe(
        role.permissions.includes('fee_payment.view'),
      )
      cleanup()
      await resetAddress()
    }
  })
})
