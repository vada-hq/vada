import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  departments,
  events,
  invites,
  members,
  organizations,
  students,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { SourcesFailed, forgetSources, loadSources, useServer } from './server'
import { readListSource, readObjectSource } from './catalog'
import { dataSourceCallsOf } from '../spec/screen-sources'
import { runMutation } from '../spec/mutations'
import { evt02 } from '../spec/screens'

// **한 화면을 끝까지 뚫는다.**

//
// 화면 여든둘이 개발용 응답으로 돌고 있었다. 그 상태로는 명세가 말하는 모양과
// 서버가 내는 모양이 같은지 아무도 재 본 적이 없다 — 계약이 실제로 쓸 만한지
// 모르는 채 216자리를 쌓게 된다.
//
// 여기서는 **진짜 서버와 진짜 Postgres**에 대고 ORG-04을 그린다. 그림 → 명세 →
// 계약 → 서버 → 저장소가 한 줄로 이어지는지가 이 검사의 전부다.

/** 지금 보는 사람의 자리. 조직을 고치는 검사만 회장으로 올린다. */
let seenAs: 'member' | 'head' | 'chair' = 'member'
let codes = 0

let app: ReturnType<typeof createApp>
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

  // 학생 명단은 구성원과 다른 표다 — 단과대학 학생 전체이고 행사 참가 확인에 쓴다.
  await fresh.db.insert(students).values([
    { id: 'S-01', orgId: 'ORG-01', name: '최바람', studentNumber: '2021567890', college: '소프트웨어융합대학', department: '컴퓨터학부', grade: '3학년', duesStatus: 'check' },
    { id: 'S-02', orgId: 'ORG-01', name: '강별', studentNumber: '2024678901', college: '소프트웨어융합대학', department: '컴퓨터학부', grade: '1학년', duesStatus: 'paid' },
  ])

  // **초대는 서버가 만든 값이다.** 화면이 지어내면 그 코드로는 아무도 못 들어온다.
  await fresh.db.insert(invites).values({
    orgId: 'ORG-01',
    code: 'AB12CD34',
    active: true,
  })

  // 인자를 넘기는 부름을 재려면 인자가 가리키는 것이 있어야 한다.
  await fresh.db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회', updatedAt: new Date('2026-07-22T18:30:00+09:00') },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영 행사', updatedAt: new Date('2026-07-22T18:30:00+09:00') },
  ])

  app = createApp({
    audit: { async write() {} },
    db,
    // **누가 보는가는 검사가 갈아 끼운다.** 조직을 고치는 자리는 회장만 열 수 있다 —
    // 그 벽이 진짜로 서 있는지도 이 검사가 재는 것 중 하나다.
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-03',
        role: seenAs,
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
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: {
      linkBase: 'https://vada.app/join',
      now: () => new Date('2026-07-22T18:30:00+09:00'),
      // **부를 때마다 다른 것을 준다.** 씨앗과 같은 값을 주면 코드가 유일하지 않아
      // 다시 만들기가 터진다 — 실서비스에서는 무작위라 날 수 없는 일이다.
      newCode: () => `NEW${(codes += 1)}CODE`,
    },
    newId: () => 'E-01',
  })

  // **인자를 그대로 넘긴다.** 주소만 넘기면 쓰기가 전부 GET이 되어 '그 자리는 명세에
  // 없다'로 막힌다 — 검사 쪽 그물이 성기면 진짜 결함이 안 보인다. 두 번째 겪는다.
  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
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
  //
  // 한동안 여기서 그냥 오류를 던졌다. 이제는 **받아 오기 시작하고 약속을 던진다** —
  // 그리기를 멈추는 신호다(`SourceGate`가 받아 카탈로그의 글을 그린다). 개발용
  // 응답이 아닌 것은 그대로다: 던지는 것이 값이 아니다.
  it('받아 두지 않은 부름은 값을 주지 않고 받아 오기 시작한다', async () => {
    // 앞 검사가 담아 둔 것을 놓는다 — 담겨 있으면 받아 올 일이 없다.
    forgetSources()
    let thrown: unknown
    try {
      readObjectSource('event.summary', { eventId: 'E-02' })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Promise)
    // 약속이 끝나면 그 자리에 값이 있다 — 다시 그리면 그려진다.
    await thrown
    expect(readObjectSource('event.summary', { eventId: 'E-02' })).toMatchObject({
      title: '2026 신입생 환영 행사',
    })
  })

  // **깨진 것은 깨졌다고 말한다.** 약속을 다시 던지면 화면이 영영 도는 것처럼 보인다.
  it('없는 것을 부르면 깨진 것으로 남는다', async () => {
    let thrown: unknown
    try {
      readObjectSource('event.summary', { eventId: 'E-99' })
    } catch (error) {
      thrown = error
    }
    await thrown
    expect(() => readObjectSource('event.summary', { eventId: 'E-99' })).toThrow(SourcesFailed)
  })
})

// **조직 보기의 나머지를 잇는다.**
//
// ORG-04(역할 표)만 서버에서 그려지고 있었다. 같은 저장소를 보는 이웃 화면들 —
// 조직도·초대·역할 바꾸기 — 은 개발용 응답을 그렸다. 서버는 그 자리들을 이미
// 답하고 있었고 화면이 그리로 가지 않았을 뿐이다.
//
// **화면마다 다른 값을 확인한다.** 개발용 응답과 저장소가 다른 값을 갖게 씨앗을
// 두었으므로, 저장소의 값이 나오면 서버를 거친 것이다.
describe('안 지은 자리 하나가 화면을 통째로 닫지 않는다', () => {
  // **자리 단위로 가린다.**
  //
  // 홈은 일곱을 읽는다. 여섯은 표가 있어 지을 수 있고 하나(`home.financeSummary`)는
  // 예산을 정해야 지을 수 있다 — 그 하나 때문에 화면이 통째로 닫히면 지어 놓은
  // 여섯을 아무도 못 본다. 사람이 그것을 보고 물었다(2026-09-05).
  //
  // 지금은 일곱이 다 안 지어졌으므로 **일곱 자리가 다 빈 자리로** 그려진다. 재는
  // 것은 값이 아니라 **모양**이다: 화면이 열리고, 안 지은 자리가 그 자리에서만
  // 가려지고, 가짜는 한 글자도 안 나온다.
  it('홈이 열리고 안 지은 자리만 그 자리에서 가려진다', async () => {
    render(<ScreenRouter screenId="HOME-01K" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />)

    // 화면 전체가 닫히지 않는다 — 바깥 그물의 글이 아니다.
    await waitFor(() => expect(screen.getAllByText('아직 준비 중입니다').length).toBeGreaterThan(0))
    expect(screen.queryByText('이 화면은 아직 준비 중입니다.')).not.toBeInTheDocument()

    // 무엇이 빠졌는지를 자리마다 말한다.
    expect(screen.getByText('전체 재정 요약')).toBeInTheDocument()
    expect(screen.getByText('진행 중·예정 행사')).toBeInTheDocument()

    // **가짜는 한 글자도 없다.**
    //
    // 고르는 말이 까다롭다 — 이 검사의 저장소에도 '박해랑'과 '2026 소프트웨어융합대학
    // 체육대회'가 들어 있고, 그것은 셸과 행사 목록이 주는 **진짜**다. 개발용 응답에만
    // 있는 말을 골라야 가짜가 샜는지를 잰다.
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('2026 소프트웨어융합대학 학술제')
    expect(drawn).not.toContain('기계시스템디자인공학과')
    // 홈이 그리던 재정 값. 개발용 응답에만 있다.
    expect(drawn).not.toContain('34%')
  })
})

describe('조직 보기의 이웃 화면들', () => {
  // **조직도의 머리와 회장단이 저장소에서 온다.** 부서 목록은 아직 서버를 안 지었으므로
  // 그 자리는 개발용 응답이다 — 한 화면 안에서 둘이 섞이는 것이 지금의 진도다.
  it('ORG-03A의 회장단이 저장소에서 온다', async () => {
    await loadSources([{ key: 'org.chartTitle', params: {} }])
    const row = readObjectSource('org.chartTitle')
    // 개발용 응답이 아니라 씨앗의 학생회 이름이 온다.
    expect(row.name).toBe('제12대 학생회')
  })

  it('회장단 줄이 저장소의 사람들이다', async () => {
    await loadSources([{ key: 'org.executives', params: {} }])
    const drawn = JSON.stringify(readListSource('org.executives'))
    // 회장은 김바다, 부서장은 이수현이다. 개발용 응답에는 없는 짝이다.
    expect(drawn).toContain('김바다')
  })

  // **초대 코드는 서버가 만든다.** 화면이 지어내면 그 코드로는 아무도 못 들어온다.
  //
  // 읽는 것도 회장만 된다(행렬의 `org.invite`). 구성원이 코드를 볼 수 있으면 누구나
  // 사람을 들일 수 있다 — 그 벽이 실제로 서 있는지도 여기서 함께 잰다.
  it('지금의 초대가 저장소에서 온다', async () => {
    seenAs = 'chair'
    await loadSources([{ key: 'org.invite', params: {} }])
    const invite = readObjectSource('org.invite')
    expect(invite.code).toBe('AB12CD34')
  })

  it('구성원은 초대 코드를 볼 수 없다', async () => {
    seenAs = 'member'
    // **담아 둔 것을 비운다.** 한 번 받아 둔 것은 다시 부르지 않으므로, 비우지 않으면
    // 앞 검사가 회장으로 받아 둔 것을 그대로 읽고 벽이 없는 것처럼 보인다.
    const again = useServer({
      baseUrl: 'http://server',
      fetch: async (input, init) => app.request(String(input), init),
    })
    try {
      await expect(loadSources([{ key: 'org.invite', params: {} }])).rejects.toThrow()
    } finally {
      again()
    }
  })

  // **거르개가 달린 화면이 서버에 붙는 순간 터지는가.** 검색어와 거르개는 화면 안의
  // 칸에 살고, 그릇은 그 값을 보지 못한다 — 목록에 올려 두고도 이 자리를 아무도
  // 그려 본 적이 없었다.
  it('ORG-07A가 서버에 붙은 채로 그려진다', async () => {
    seenAs = 'chair'
    render(<ScreenRouter screenId="ORG-07A" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />)
    await waitFor(() => expect(screen.getByText('최바람')).toBeInTheDocument())
  })

  // **쓰고 나면 읽은 것이 낡는다.**
  //
  // 그릇은 한 번 받아 둔 부름을 다시 부르지 않는다. 그래서 초대 코드를 다시 만들면
  // 저장소는 바뀌는데 **화면은 옛 코드를 그대로 그린다** — 그 코드를 받은 사람은
  // 못 들어온다. 위의 '구성원은 초대 코드를 볼 수 없다'가 이 성질 때문에 서버를
  // 갈아 끼워 그릇을 비우고 있었고, 그때 이것이 검사 사정이 아니라 **화면의 결함**
  // 이라는 것이 이미 적혀 있었다.
  it('다시 만든 초대 코드가 곧바로 읽힌다', async () => {
    seenAs = 'chair'
    await loadSources([{ key: 'org.invite', params: {} }])
    const before = readObjectSource('org.invite').code

    // 화면이 누르는 그 길로 다시 만든다.
    await runMutation('org.regenerateInvite', {}, {})

    await loadSources([{ key: 'org.invite', params: {} }])
    expect(readObjectSource('org.invite').code).not.toBe(before)
  })

  it('고를 수 있는 사람이 저장소에서 온다', async () => {
    seenAs = 'member'
    await loadSources([{ key: 'org.roleAssignments', params: {} }])
    const drawn = JSON.stringify(readListSource('org.roleAssignments'))
    expect(drawn).toContain('이수현')
  })

  // **화면이 누르는 그 길로 바꾼다.** 서버를 직접 부르면 그 사이의 코드가 빠진다.
  it('화면이 누르는 길로 역할이 바뀐다', async () => {
    seenAs = 'chair'
    const answer = await runMutation('org.changeRole', { baseRole: 'head' }, { memberId: 'M-11' })
    // 계약이 '돌려주는 값이 없다'고 적었다. 던지지 않은 것이 성공이다.
    expect(answer).toEqual({})
  })

  it('화면이 누르는 길로 초대를 다시 만든다', async () => {
    seenAs = 'chair'
    const answer = await runMutation('org.regenerateInvite', {}, {})
    // **새 초대가 돌아온다.** 옛 코드는 그 순간 죽으므로 화면이 새 것을 그려야 한다.
    expect(answer.code).not.toBe('AB12CD34')
    expect(String(answer.code).length).toBeGreaterThan(0)
  })

  // **코드만·링크만 다시 만드는 자리가 따로 있다.** 한 건이 둘을 함께 가지므로 셋이
  // 같은 일을 한다 — 그 사실을 숨기지 않고 셋 다 열어 두었고, 셋 다 재 둔다.
  it('코드만 다시 만드는 길도 열려 있다', async () => {
    seenAs = 'chair'
    const answer = await runMutation('org.regenerateInviteCode', {}, {})
    expect(String(answer.code).length).toBeGreaterThan(0)
  })

  it('링크만 다시 만드는 길도 열려 있다', async () => {
    seenAs = 'chair'
    const answer = await runMutation('org.regenerateInviteLink', {}, {})
    expect(String(answer.url).length).toBeGreaterThan(0)
  })

  // **구성원은 조직을 고치지 못한다.** 행렬이 그렇게 적었고, 그 벽이 실제로 선다.
  it('구성원이 역할을 바꾸려 하면 막힌다', async () => {
    seenAs = 'member'
    await expect(
      runMutation('org.changeRole', { baseRole: 'head' }, { memberId: 'M-11' }),
    ).rejects.toThrow()
  })
})

// **학생 명단이 저장소에서 온다.** 거르는 것도 세는 것도 서버가 한다.
describe('학생 명단', () => {
  it('명단이 저장소에서 오고 상태가 완성된 글이다', async () => {
    seenAs = 'member'
    await loadSources([{ key: 'org.students', params: {} }])
    const rows = readListSource('org.students')
    const drawn = JSON.stringify(rows)
    // 개발용 응답의 학번(2022123456)이 아니라 씨앗의 학번이 온다.
    expect(drawn).toContain('2021567890')
    expect(drawn).toContain('확인 필요')
  })

  // **총 건수는 거른 뒤의 것이다.** 화면이 세지 않고 서버가 말한다.
  it('총 건수를 서버가 완성된 문구로 준다', async () => {
    await loadSources([{ key: 'org.studentPaging', params: {} }])
    expect(readObjectSource('org.studentPaging').totalNote).toBe('총 2명')
  })

  // **범위는 조직 설정이 정한다.** 이 학생회는 대표 범위를 안 정했으므로 그렇게 말한다.
  it('명단의 범위를 서버가 말한다', async () => {
    await loadSources([{ key: 'org.rosterScope', params: {} }])
    expect(readObjectSource('org.rosterScope').path).toBe('대표 범위 미등록')
  })

  it('조직 관리 영역의 한 줄이 셈에서 온다', async () => {
    await loadSources([{ key: 'org.areaSummaries', params: {} }])
    expect(readObjectSource('org.areaSummaries').students).toContain('학생 2명')
  })
})
