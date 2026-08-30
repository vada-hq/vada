import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import { departments, members, organizations } from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { useServer } from './server'

// **한 화면을 끝까지 뚫는다.**

//
// 화면 여든둘이 개발용 응답으로 돌고 있었다. 그 상태로는 명세가 말하는 모양과
// 서버가 내는 모양이 같은지 아무도 재 본 적이 없다 — 계약이 실제로 쓸 만한지
// 모르는 채 216자리를 쌓게 된다.
//
// 여기서는 **진짜 서버와 진짜 Postgres**에 대고 ORG-04을 그린다. 그림 → 명세 →
// 계약 → 서버 → 저장소가 한 줄로 이어지는지가 이 검사의 전부다.

let restore: () => void
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  const db = fresh.db as never
  close = fresh.close

  await fresh.db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await fresh.db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '학술체육부' },
    { id: 'D-02', orgId: 'ORG-01', name: '기획부' },
  ])
  await fresh.db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', departmentId: 'D-01' },
    { id: 'M-11', orgId: 'ORG-01', name: '이수현', role: 'head', departmentId: 'D-02' },
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-01' },
  ])

  const app = createApp({
    audit: { async write() {} },
    db,
    who: () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-03',
        role: 'member',
        departmentId: 'D-01',
        inFinanceDepartment: false,
      },
    }),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    attempts: inMemoryAttempts(),
    invite: {
      linkBase: 'https://vada.app/join',
      now: () => new Date('2026-07-22T18:30:00+09:00'),
      newCode: () => 'AB12CD34',
    },
    newId: () => 'E-01',
  })

  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input) => app.request(String(input)),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('ORG-04을 서버에서 그린다', () => {
  it('역할 수가 저장소에서 온다', async () => {
    render(<ScreenRouter screenId="ORG-04" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />)

    // 표가 오면 화면이 다 그려진 것이다.
    await waitFor(() =>
      expect(screen.getByText('재정 현황·사용 내역 열람')).toBeInTheDocument(),
    )
    // **개발용 응답은 1·3·3인데 저장소에는 1·1·1이 들어 있다.** 셋 다 1로 보이면
    // 그 값이 저장소에서 세어져 온 것이다 — 개발용 응답으로는 나올 수 없는 모습이다.
    const drawn = document.body.textContent ?? ''
    expect([...drawn.matchAll(/1명/g)]).toHaveLength(3)
    expect(drawn).not.toContain('3명')
  })

  // 표는 저장소가 아니라 정책에서 온다 — 행렬은 모든 학생회가 같다.
  it('권한 표가 정책에서 온다', async () => {
    render(<ScreenRouter screenId="ORG-04" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />)
    await waitFor(() =>
      expect(screen.getByText('예산 수정·구매 승인·증빙 처리')).toBeInTheDocument(),
    )
    // 초대는 회장단만으로 정했다. 그림이 그린 '자기 부서만'은 이제 나오지 않는다.
    expect(screen.queryByText('자기 부서만')).not.toBeInTheDocument()
  })

  // 실패하면 카탈로그의 글이 그려진다. 서버가 붙으면 실제로 실패하는 순간이 생긴다.
  it('서버가 실패하면 카탈로그의 글을 그린다', async () => {
    const back = useServer({
      baseUrl: 'http://server',
      fetch: async () => new Response('nope', { status: 500 }),
    })
    try {
      render(<ScreenRouter screenId="ORG-04" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />)
      await waitFor(() =>
        expect(screen.getByText('권한을 불러오지 못했습니다')).toBeInTheDocument(),
      )
    } finally {
      back()
    }
  })
})
