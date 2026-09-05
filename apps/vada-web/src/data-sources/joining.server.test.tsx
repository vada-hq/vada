import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import { users } from '../../../api/src/db/schema.ts'
import { viewerLookup } from '../../../api/src/auth/viewer.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { fetchOptions } from '../option-sources/catalog'
import { runMutation } from '../spec/mutations'
import { useServer } from './server'

// **학생회에 들어오는 길을 끝까지 뚫는다.**
//
// 한 사람이 학생회를 만들고, **다른 사람이 그 초대 코드로 그 학생회를 본다.**
// 그림 → 명세 → 계약 → 서버 → 저장소가 한 줄로 이어지는지가 이 검사의 전부다.
//
// 앞선 검사(ORG-04)는 이미 저장소에 든 것을 읽기만 했다. 여기서는 **쓰고 나서 읽는다** —
// 만든 값이 그대로 다른 사람에게 보이지 않으면 흐름이 이어진 것이 아니다.

let restore: () => void
let close: () => Promise<void>
let request: (path: string, init?: RequestInit) => Promise<Response>
// 누가 부르는가는 검사가 갈아 끼운다. 한 사람이 만들고 다른 사람이 본다.
//
// **소속은 손으로 짜지 않는다.** 진짜 조회(`viewerLookup`)를 그대로 쓰므로, 학생회를
// 만든 뒤 그 사람에게 소속이 실제로 생겼는지까지 이 검사가 재게 된다.
let signedInAs: string | null = null
let made = 0
let codes = 0
/** 로그인 층이 어느 제공자로 불렸나. 검사가 그것을 본다. */
const started: string[] = []

/** ORG-01과 ORG-02가 함께 채운 `orgCreationDraft`. */
const DRAFT = {
  orgType: 'college',
  repSchool: 'SCH-HYU-ERICA',
  repCollege: 'COL-HYU-ERICA-SW',
  orgName: '제12대 소프트웨어융합대학 학생회',
  operatingYear: '2026',
  setupMode: 'basic',
  departments: [{ name: '기획부' }, { name: '홍보부' }],
}

const CHAIR = 'U-01'
const NEWCOMER = 'U-02'

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  // 만드는 사람이 첫 구성원(회장)이 되므로 그 사람이 저장소에 있어야 한다.
  await fresh.db.insert(users).values([
    { id: 'U-01', email: 'chair@example.ac.kr', name: '김바다' },
    { id: 'U-02', email: 'new@example.ac.kr', name: '박해랑' },
  ])

  const lookup = viewerLookup(fresh.db as never)
  const app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => (signedInAs === null ? null : lookup.who({ userId: signedInAs })),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    // **밖으로 나가지는 않는다.** Better Auth가 구글을 부르는 자리이고 검사가 그리로
    // 갈 수는 없다. 여기서 재는 것은 그 앞까지다 — 화면이 누른 것이 계약의 자리에
    // 닿아 권한을 지나 이 층을 부르는가.
    signIn: {
      open: () => ({ google: true, kakao: true }),
      start: async (provider: string) => {
        started.push(provider)
        return { url: `https://example.test/${provider}` }
      },
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: {
      linkBase: 'https://vada.app/join',
      now: () => new Date('2026-09-01T18:30:00+09:00'),
      // **부를 때마다 다른 것을 준다.** 학생회를 만들면 첫 초대가 함께 생기고, 곧
      // 다시 만들기를 누르면 또 하나가 생긴다 — 하나로 고정하면 둘이 같은 코드로
      // 부딪힌다. 진짜 서버는 임의의 아홉 바이트를 쓰므로 겹치지 않는다.
      newCode: () => `CODE${(codes += 1)}`,
    },
    // **부를 때마다 다른 것을 준다.** 하나로 고정하면 부서 둘이 같은 열쇠로 들어간다.
    newId: () => `X-${(made += 1)}`,
  })
  request = async (path, init) => app.request(path, init)

  // **학교 목록도 로그인이 필요하다**(`signedIn`). 부르는 사람을 먼저 정한다.
  signedInAs = CHAIR
  // **인자를 그대로 넘긴다.** 한동안 주소만 넘겼는데, 그러면 쓰기가 전부 GET이 되어
  // '그 자리는 명세에 없다'로 막힌다 — 검사 쪽 그물이 성기면 진짜 결함이 안 보인다.
  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('학교의 편제가 저장소에서 온다', () => {
  // **옮김 파일이 심은 씨앗이다.** 여기서 한양대가 나오면 `npm run db:migrate`만 도는
  // 실서비스에서도 나온다 — 검사용 SQL과 실서비스 옮김 파일이 같은 것이기 때문이다.
  it('학교를 검색하면 저장소가 답한다', async () => {
    expect(await fetchOptions('education.schools', {}, '한양')).toEqual([
      { value: 'SCH-HYU-ERICA', label: '한양대학교 ERICA' },
    ])
  })

  it('고른 학교의 단과대학만 온다', async () => {
    expect(await fetchOptions('education.colleges', { schoolId: 'SCH-HYU-ERICA' })).toEqual([
      { value: 'COL-HYU-ERICA-SW', label: '소프트웨어융합대학' },
    ])
  })

  it('고른 단과대학의 학부·학과가 온다', async () => {
    const found = await fetchOptions('education.departments', {
      schoolId: 'SCH-HYU-ERICA',
      collegeId: 'COL-HYU-ERICA-SW',
    })
    expect(found.length).toBeGreaterThan(0)
    expect(found.map((option) => option.label)).toContain('ICT융합학부')
  })

  // 개발용 응답에는 없는 학교가 있었다. 그것이 나오면 서버를 안 거친 것이다.
  it('개발용 응답의 학교는 나오지 않는다', async () => {
    expect(await fetchOptions('education.schools', {}, '서울')).toEqual([])
  })
})

describe('만든 학생회를 다른 사람이 초대로 본다', () => {
  let code: string

  // **화면이 쓰는 그 길로 만든다.** 오랫동안 `runMutation`이 아무 데도 안 보내고
  // 무조건 성공을 돌려줬다 — '조직 만들기'를 누르면 학생회가 안 생겼는데 다음 화면으로
  // 넘어갔고, 그다음 화면이 403 벽을 만나서야 드러났다. 배포하고 사람이 눌러 본 뒤였다.
  it('화면이 누르는 길로 학생회가 만들어진다', async () => {
    signedInAs = CHAIR
    const answer = await runMutation('org.create', DRAFT)
    // 계약이 '돌려주는 값이 없다'고 적었다. 빈 것이 정상이고, 던지지 않은 것이 성공이다.
    expect(answer).toEqual({})

    // **만든 사람에게 소속이 생겼다.** 다음 줄이 회장 권한을 요구하므로, 여기가
    // 통과하는 것 자체가 '만드는 사람이 첫 구성원(회장)'이 지켜졌다는 증거다.
    // 되돌릴 수 없는 자리라 계약이 멱등 키를 요구한다 — 두 번 눌러 이미 나눠 준
    // 코드를 두 번 죽이지 않게 한다.
    const mine = await request('/api/org/invite', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'KEY-INVITE' },
    })
    expect(mine.status).toBe(200)
    const current = await (await request('/api/org/invite')).json()
    code = current.code as string
    // **첫 초대가 아니라 다시 만든 것이다.** 학생회를 만들 때 하나가 생겼고 위에서
    // 다시 만들었으므로 두 번째다 — 그 사실이 코드에 그대로 보인다.
    expect(code).toBe('CODE2')
  })

  // **여기가 고리가 닫히는 자리다.** 아직 아무 학생회에도 없는 다른 사람이,
  // 코드만 들고 와서 그 학생회를 본다.
  it('INV-01이 그 학생회를 그린다', async () => {
    signedInAs = NEWCOMER
    render(
      <ScreenRouter
        screenId="INV-01"
        screenParams={{ inviteCode: code }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('제12대 소프트웨어융합대학 학생회')).toBeInTheDocument(),
    )
    // **서버가 완성된 글을 준다.** 화면이 학교와 단과대를 이어 붙이지 않는다.
    const drawn = document.body.textContent ?? ''
    expect(drawn).toContain('한양대학교 ERICA · 소프트웨어융합대학')
    expect(drawn).toContain('단과대 학생회')
    expect(drawn).toContain('2026년')
  })

  // **만든 사람이 곧바로 집을 연다.** 조직 만들기가 끝나면 HOME-01K로 가는데,
  // 그 화면이 읽는 셸 둘이 여기서 답해야 한다. 한동안 여기가 403이었다 — 학생회가
  // 만들어지지 않았기 때문인데, 화면은 다음으로 넘어갔다.
  it('만든 사람이 곧바로 셸을 읽는다', async () => {
    signedInAs = CHAIR
    expect((await request('/api/shell/organization')).status).toBe(200)
    expect((await request('/api/shell/viewer')).status).toBe(200)
  })

  // **초대 코드를 확인하는 길.** 진짜로 보낸다고 목록에 올려 두고 이 길로 보내 본 적이
  // 없었다 — 화면이 부르는 그 함수로 서버에 닿는지 아무도 재지 않았다.
  it('화면이 누르는 길로 초대 코드를 확인한다', async () => {
    signedInAs = NEWCOMER
    const answer = await runMutation('organization.verifyInviteCode', {
      inviteCode: code,
      school: 'SCH-HYU-ERICA',
      college: 'COL-HYU-ERICA-SW',
      department: 'DEP-HYU-ERICA-SW-CS',
      currentGrade: '3',
      studentNumber: '2022123456',
      name: '박해랑',
    })
    // 계약이 '돌려주는 값이 없다'고 적었다. 던지지 않은 것이 성공이다.
    expect(answer).toEqual({})
  })

  it('없는 코드는 던진다 — 화면이 맞는지 스스로 알 수 없다', async () => {
    signedInAs = NEWCOMER
    await expect(
      runMutation('organization.verifyInviteCode', {
        inviteCode: 'NOPE0000',
        school: 'SCH-HYU-ERICA',
        college: 'COL-HYU-ERICA-SW',
        department: 'DEP-HYU-ERICA-SW-CS',
        currentGrade: '3',
        studentNumber: '2022123456',
        name: '박해랑',
      }),
    ).rejects.toThrow()
  })

  it('없는 코드면 카탈로그의 글을 그린다', async () => {
    signedInAs = NEWCOMER
    render(
      <ScreenRouter
        screenId="INV-01"
        screenParams={{ inviteCode: 'NOPE0000' }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('학생회를 불러오지 못했습니다')).toBeInTheDocument(),
    )
  })
})

// **들어오는 길.** 로그인 자리는 로그인이 필요 없다(계약의 `public`) — 아직 아무도
// 아닌 사람이 부른다. 그 사실이 실제로 서버에서도 참인지 여기서 잰다.
//
// 진짜로 보낸다고 목록에 올려 두고 이 길로 보내 본 적이 없었다. 그동안 화면이 서버의
// 답을 버리고 있었고, 사람이 눌러 보고서야 알았다(2026-09-02).
describe('들어오는 길이 열려 있다', () => {
  it('로그인하지 않은 사람이 구글로 가는 주소를 받는다', async () => {
    signedInAs = null
    started.length = 0
    const answer = await runMutation('auth.signInGoogle', {})
    expect(started).toEqual(['google'])
    // **주소를 돌려줘야 한다.** 이 값을 버리면 눌러도 아무 일이 안 일어난다.
    expect(answer.url).toBe('https://example.test/google')
  })

  it('카카오도 같은 길이다', async () => {
    signedInAs = null
    started.length = 0
    const answer = await runMutation('auth.signInKakao', {})
    expect(started).toEqual(['kakao'])
    expect(answer.url).toBe('https://example.test/kakao')
  })

  it('어느 길이 열려 있는지 서버가 답한다', async () => {
    signedInAs = null
    const res = await request('/api/sign-in/ways')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ google: true, kakao: true })
  })
})
