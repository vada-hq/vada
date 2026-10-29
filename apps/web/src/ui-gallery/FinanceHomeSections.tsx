import { useState } from 'react'
import FinanceHome from '@/home/FinanceHome'
import FinanceSummary from '@/home/FinanceSummary'
import CouncilHome from '@/home/CouncilHome'
import HomeViewButtons from '@/home/HomeViewButtons'
import { Section } from './GallerySection'
import {
  financeBoard,
  financeCouncilId,
  financeHome,
  financeRooms,
  financeSummary,
} from './finance-home-samples'
import { noop, Width } from './home-frame-samples'

const widths = [
  ['1280', 'w-248'],
  ['1024', 'w-184'],
  ['390', 'w-89'],
] as const

const councilBoard = {
  financeStaffed: true,
  events: { cards: [], counts: { planning: 0, ongoing: 0, followUp: 0 } },
  followUp: { events: [], total: 0 },
  attention: { items: [], total: 0 },
  unassignedMembers: 0,
  ops: {
    rows: [],
    counts: { late: 0, today: 0, tomorrow: 0, approval: 0 },
    assign: { noDepartment: 0, unassignedMembers: 0, financeStaffed: true },
    total: 0,
  },
}

// 견본을 누를 때 갤러리 주소를 바꾸지 않는다. 실제 홈의 주소 유지·새로 읽기는 FinanceHome.test가 검사한다.
function DualSample() {
  const [finance, setFinance] = useState(false)
  return (
    <>
      <HomeViewButtons finance={finance} onChange={setFinance} />
      {finance ? (
        <FinanceHome
          home={financeHome}
          board={financeBoard}
          councilId={financeCouncilId}
          name="김바다"
          rooms={financeRooms}
        />
      ) : (
        <CouncilHome
          home={{ ...financeHome, kind: 'council', financeView: true, financeSummary }}
          board={councilBoard}
          councilId={financeCouncilId}
          name="김바다"
          onOpenEvent={noop}
          onOpenPage={noop}
        />
      )}
    </>
  )
}

export function FinanceHomeSection() {
  return (
    <Section title="재정부 홈(HOME-01F) · 재정부장 조건부 줄">
      {widths.map(([width, className]) => (
        <Width key={width} label={`${width}px 창(재정부장 홈)`} className={`${className} shrink-0`}>
          <FinanceHome
            home={financeHome}
            board={financeBoard}
            councilId={financeCouncilId}
            name="김바다"
            rooms={financeRooms}
          />
        </Width>
      ))}
      <Width label="390px 창(첫 사용: 빈 카드)" className="w-89 shrink-0">
        <FinanceHome
          home={{ ...financeHome, featuredEvents: [] }}
          board={{
            pending: { requests: [], total: 0, truncated: false },
            nearby: { items: [], total: 0 },
            settling: { events: [], total: 0 },
            budgets: { events: [], total: 0 },
            departments: [],
            ownedEnded: [],
          }}
          councilId={financeCouncilId}
          name="김바다"
          rooms={financeRooms}
        />
      </Width>
    </Section>
  )
}

export function HomeFinanceSummarySection() {
  return (
    <Section title="홈 · 전체 재정 요약과 회장단+재정 전환">
      {widths.map(([width, className]) => (
        <Width
          key={width}
          label={`${width}px 창(회장단 재정 요약)`}
          className={`${className} shrink-0`}
        >
          <FinanceSummary summary={financeSummary} onOpen={noop} />
          <FinanceSummary summary={{ overview: null, missing: [] }} onOpen={noop} />
        </Width>
      ))}
      {widths.map(([width, className]) => (
        <Width
          key={`dual-${width}`}
          label={`${width}px 창(회장단+재정: 보기 전환)`}
          className={`${className} shrink-0`}
        >
          <DualSample />
        </Width>
      ))}
    </Section>
  )
}
