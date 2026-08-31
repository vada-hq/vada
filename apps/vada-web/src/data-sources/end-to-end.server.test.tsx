import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import { departments, events, members, organizations, users } from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { loadSources, useServer } from './server'
import { readObjectSource } from './catalog'
import { dataSourceCallsOf } from '../spec/screen-sources'
import { evt02 } from '../spec/screens'

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
  // **보는 사람도 저장소에 있어야 한다.** 한동안 없어도 검사가 통과했는데, 그때
  // 셸은 서버가 아니라 개발용 응답을 그리고 있었다 — `fromServer`가 못 받아 둔 것을
  // 조용히 넘겼기 때문이다. 이제 그 자리가 터지므로 여기에 진짜 사람을 둔다.
  await fresh.db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await fresh.db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', departmentId: 'D-01' },
    { id: 'M-11', orgId: 'ORG-01', name: '이수현', role: 'head', departmentId: 'D-02' },
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-01', userId: 'U-01' },
  ])

  // 인자를 넘기는 부름을 재려면 인자가 가리키는 것이 있어야 한다.
  await fresh.db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회', updatedAt: new Date('2026-07-22T18:30:00+09:00') },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영 행사', updatedAt: new Date('2026-07-22T18:30:00+09:00') },
  ])

  const app = createApp({
    audit: { async write() {} },
    db,
    who: async () => ({
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
    counter: inMemoryCounter(),
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

// **인자를 넘기는 길이 열렸는지 잰다.**
//
// 오랫동안 인자 없는 출처만 서버로 부를 수 있었다. 145개 중 30개다 — 나머지가
// 못 붙으면 자리를 아무리 만들어도 화면이 못 쓴다.
describe('인자를 넘겨 부른다', () => {
  it('명세를 걸으면 어떤 인자로 부르는지가 나온다', () => {
    const calls = dataSourceCallsOf(evt02, { screenParams: { eventId: 'E-01' } })
    // 화면 코드를 읽지 않았다. 요소마다 붙은 params가 어디서 오는지 적어 두었고
    // (`screenParam: eventId`) 그것을 그대로 채웠다.
    expect(calls).toContainEqual({ key: 'event.summary', params: { eventId: 'E-01' } })
  })

  it('인자가 가리키는 것을 서버가 답한다', async () => {
    await loadSources([{ key: 'event.summary', params: { eventId: 'E-01' } }])
    expect(readObjectSource('event.summary', { eventId: 'E-01' })).toMatchObject({
      title: '2026 소프트웨어융합대학 체육대회',
    })
  })

  // **담아 두는 칸이 인자까지 품는지가 여기서 갈린다.** key로만 담으면 뒤엣것이
  // 앞엣것을 덮고, 화면은 남의 행사를 그린다.
  it('같은 출처를 다른 인자로 부르면 서로 덮지 않는다', async () => {
    await loadSources([
      { key: 'event.summary', params: { eventId: 'E-01' } },
      { key: 'event.summary', params: { eventId: 'E-02' } },
    ])
    expect(readObjectSource('event.summary', { eventId: 'E-01' })).toMatchObject({
      title: '2026 소프트웨어융합대학 체육대회',
    })
    expect(readObjectSource('event.summary', { eventId: 'E-02' })).toMatchObject({
      title: '2026 신입생 환영 행사',
    })
  })

  // **조용히 개발용 응답으로 돌아가지 않는다.** 그러면 화면은 그려지는데 그 값이
  // 어디서 왔는지 아무도 모른다.
  it('받아 두지 않은 부름은 터뜨린다', () => {
    expect(() => readObjectSource('event.summary', { eventId: 'E-99' })).toThrow(/받아 두지 않았습니다/)
  })
})

