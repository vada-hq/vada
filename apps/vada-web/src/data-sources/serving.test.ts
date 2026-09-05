import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readObjectSource } from './catalog'
import { fetchOptions } from '../option-sources/catalog'
import mutationsJson from '../../../../specs/figma/vada-wireframe/mutations.json'
import { NotServedYet, runMutation } from '../spec/mutations'
import { isServedMutation } from './served'
import {
  NotBuiltYet,
  SourcesFailed,
  servingAs,
  currentServer,
  loadSources,
  servingFromServer,
  startServing,
  urlOf,
  useServer,
} from './server'

// **앱이 진짜로 서버에 붙는가.**
//
// 서버를 짓고 배포하고 로그인까지 되는데도 화면이 그리는 값이 전부 개발용 응답인
// 채로 오래 있었다. `useServer`를 부르는 곳이 검사뿐이었기 때문이다 — 검사 안에서는
// 서버가 켜지고 진짜 브라우저에서는 안 켜졌는데, **화면이 멀쩡히 그려지니 아무도
// 몰랐다.** 그 자리를 여기서 잰다.

let back: (() => void) | null = null

afterEach(() => {
  back?.()
  back = null
})

describe('앱이 켜질 때 서버에 붙는다', () => {
  it('붙이면 켜진다', () => {
    expect(servingFromServer()).toBe(false)
    back = startServing()
    expect(servingFromServer()).toBe(true)
    // 쿠키를 함께 보내는 그 fetch여야 한다. 맨 fetch면 로그인해도 남으로 보인다.
    expect(currentServer()?.fetch).not.toBe(globalThis.fetch)
  })

  // **시나리오 검사용 빌드만 안 붙는다.** 그 빌드는 `dist-e2e/`로만 나가므로
  // 실서비스가 나가는 `dist/`는 늘 서버에 붙는다.
  it('개발용 응답으로 도는 빌드에서는 안 붙는다', () => {
    const before = import.meta.env.VITE_FIXTURES
    import.meta.env.VITE_FIXTURES = '1'
    try {
      const undo = startServing()
      expect(servingFromServer()).toBe(false)
      undo()
    } finally {
      import.meta.env.VITE_FIXTURES = before
    }
  })

  // **실서비스로 나가는 빌드가 그 표시를 달면 화면이 통째로 가짜가 된다.**
  // 자리를 가른 것이 그것을 막는데, 가른 자리를 여기서도 붙잡아 둔다.
  it('검사용 빌드는 실서비스와 다른 자리로 나간다', () => {
    const runner = readFileSync(
      fileURLToPath(new URL('../../../../scripts/run-e2e.mjs', import.meta.url)),
      'utf8',
    )
    expect(runner).toContain("VITE_FIXTURES: '1'")
    expect(runner).toContain('dist-e2e')
  })

  // **부르는 곳이 없으면 위의 검사는 아무것도 지키지 못한다.** 함수가 있고 동작해도
  // 앱이 안 부르면 사람이 보는 것은 그대로 개발용 응답이다 — 그것이 실제로 일어난 일이라
  // 여기서 그 한 줄을 직접 확인한다.
  it('main.tsx가 그것을 부른다', () => {
    const main = readFileSync(fileURLToPath(new URL('../main.tsx', import.meta.url)), 'utf8')
    expect(main).toContain('startServing()')
  })
})

describe('고르는 목록도 서버에서 온다', () => {
  // 표는 진짜인데 고를 것이 가짜면 사람은 없는 학교를 고르고 저장할 때 터진다.
  it('진짜에 오른 목록은 서버가 답한다', async () => {
    const asked: string[] = []
    back = useServer({
      baseUrl: 'http://server',
      fetch: async (input) => {
        asked.push(String(input))
        return Response.json([{ value: 'SCH-01', label: '서버가 준 학교' }])
      },
    })

    expect(await fetchOptions('education.schools', {}, '한양')).toEqual([
      { value: 'SCH-01', label: '서버가 준 학교' },
    ])
    // 검색어의 이름은 계약이 정한다(`search.queryParam`). 화면이 지어내지 않는다.
    expect(asked).toEqual(['http://server/api/education/schools?q=%ED%95%9C%EC%96%91'])
  })

  it('인자를 주소에 싣는다', async () => {
    const asked: string[] = []
    back = useServer({
      baseUrl: '',
      fetch: async (input) => {
        asked.push(String(input))
        return Response.json([])
      },
    })
    await fetchOptions('education.departments', { schoolId: 'S-1', collegeId: 'C-1' })
    expect(asked).toEqual(['/api/education/departments?schoolId=S-1&collegeId=C-1'])
  })

  // **조용히 돌아가지 않는다.** 서버가 죽었는데 개발용 응답을 그리면 화면은 멀쩡히
  // 목록을 내고 사람은 없는 학교를 고른다.
  it('서버가 실패하면 던진다', async () => {
    back = useServer({
      baseUrl: '',
      fetch: async () => new Response('nope', { status: 500 }),
    })
    await expect(fetchOptions('education.schools', {}, '한양')).rejects.toThrow(
      "선택지 출처 'education.schools'를 받지 못했습니다(500).",
    )
  })

  // **아직 안 붙은 목록은 개발용 응답을 주지 않는다.**
  //
  // 한동안 주었다 — 서버를 켜도 안 붙은 목록은 가짜로 돌아갔고, 어느 것이 붙었는지는
  // `served.ts`가 코드로 들고 있으니 조용한 대체가 아니라고 적어 두었다. **사람은
  // 그 파일을 읽지 않는다**: 배포된 앱에서 새로 만든 빈 학생회가 남의 값을 골랐다
  // (2026-09-05). 표가 진짜인데 고를 것이 가짜면 없는 것을 고르고 저장할 때 터진다.
  //
  // 서버를 부르지도 않는다 — 계약에 자리는 있어도 답할 것이 없다.
  it('진짜에 없는 목록은 가짜를 주지 않고 아직 안 지었다고 말한다', async () => {
    let called = false
    back = useServer({
      baseUrl: '',
      fetch: async () => {
        called = true
        return Response.json([])
      },
    })
    // 본보기는 **아직 서버에 안 붙은 원격 목록**이어야 한다. 한동안 구매 유형을 썼는데
    // 2026-09-06에 명세가 그 값을 들게 되어(static) 서버 자리 자체가 없어졌다.
    await expect(fetchOptions('meeting.modes', {})).rejects.toBeInstanceOf(NotBuiltYet)
    expect(called).toBe(false)
  })

  // 서버를 안 켠 동안(검사·그림 대조)은 그대로 개발용 응답이다. 그 자리까지 막으면
  // 화면을 그림과 견줄 수 없다 — 견주려면 그림이 그린 그 값이 화면에 있어야 한다.
  it('서버를 안 켜면 그대로 개발용 응답이다', async () => {
    expect(await fetchOptions('finance.purchaseTypes', {})).not.toEqual([])
  })
})

describe('주소를 짓는 규칙이 한 벌이다', () => {
  it('경로에 박힌 인자는 그 자리에, 나머지는 조회 인자로', () => {
    expect(urlOf('/api/organizations/by-invite-code/{inviteCode}', { inviteCode: 'AB 12' })).toBe(
      '/api/organizations/by-invite-code/AB%2012',
    )
    expect(urlOf('/api/education/colleges', { schoolId: 'S-1' })).toBe(
      '/api/education/colleges?schoolId=S-1',
    )
  })
})

describe('실패한 것만 실패했다고 말한다', () => {
  // **한 출처가 실패하면 그 화면이 기다리는 전부를 못 불러왔다고 적고 있었다.**
  //
  // HOME-01K이 읽는 아홉 중 진짜로 서버에서 오는 것은 둘뿐인데, 그 둘이 막히자
  // 요청조차 나가지 않은 일곱까지 빨갛게 나왔다 — 사람은 아홉 군데가 고장 난 줄
  // 알고 없는 자리를 뒤진다. 다음 흐름마다 디버깅을 헷갈리게 할 자리다.
  it('받지 못한 부름의 이름만 알린다', async () => {
    back = useServer({
      baseUrl: '',
      fetch: async (input) =>
        String(input).includes('/api/shell/viewer')
          ? new Response('nope', { status: 500 })
          : Response.json({ name: '테스트학생회' }),
    })

    const failed = await loadSources([
      { key: 'shell.organization', params: {} },
      { key: 'shell.viewer', params: {} },
      // 진짜가 아닌 것은 부르지도 않는다. 실패했다고 말해서도 안 된다.
      { key: 'home.briefing', params: {} },
    ]).then(
      () => [],
      (thrown: unknown) => (thrown instanceof SourcesFailed ? thrown.keys : ['던진 것이 SourcesFailed가 아니다']),
    )

    expect(failed).toEqual(['shell.viewer'])
  })

  it('둘이 막히면 둘 다 말한다', async () => {
    back = useServer({ baseUrl: '', fetch: async () => new Response('nope', { status: 500 }) })
    const failed = await loadSources([
      { key: 'shell.organization', params: {} },
      { key: 'shell.viewer', params: {} },
    ]).then(
      () => [],
      (thrown: unknown) => (thrown instanceof SourcesFailed ? [...thrown.keys].sort() : ['아니다']),
    )
    expect(failed).toEqual(['shell.organization', 'shell.viewer'])
  })
})

describe('아직 안 붙은 쓰기는 성공한 척하지 않는다', () => {
  // **이것이 오늘 가장 비쌌던 결함이다.**
  //
  // `runMutation`이 아무 데도 안 보내고 무조건 성공을 돌려줬다. '조직 만들기'를
  // 누르면 학생회가 안 생기는데 다음 화면으로 넘어갔고, 배포하고 사람이 눌러 본
  // 뒤에야 드러났다. 목록에 한 줄을 빠뜨리기만 해도 같은 일이 다시 난다.
  //
  // 그래서 **서버가 켜져 있는데 목록에 없으면 던진다.** 아무 일도 안 일어났다는
  // 사실이 사람에게 보여야 한다.
  //
  // **어느 쓰기로 잴지는 카탈로그에서 고른다.** 한동안 이름을 손으로 박아 두었는데
  // (meeting.create), 그것이 붙는 날 이 검사가 빨개졌다 — 재려는 것은 '그 자리'가
  // 아니라 '아직 안 붙은 자리'다. 아직 안 붙은 것 중 첫째를 쓰면 낡지 않는다.
  it('서버가 켜져 있는데 목록에 없으면 던진다', async () => {
    const notYet = (mutationsJson as { mutations: Array<{ key: string }> }).mutations
      .map((one) => one.key)
      .find((key) => !isServedMutation(key))
    // 전부 붙은 날에는 이 검사가 잴 것이 없다. 조용히 통과하지 않고 그 사실을 말한다.
    expect(notYet, '쓰기가 전부 붙었습니다 — 이 검사는 이제 잴 것이 없습니다').toBeDefined()
    back = useServer({ baseUrl: '', fetch: async () => Response.json({}) })
    await expect(runMutation(notYet!, {})).rejects.toBeInstanceOf(NotServedYet)
  })

  // **'서버가 고장 난 것'과 '아직 안 붙은 것'은 다른 일이다.** 같은 글로 말하면
  // 남은 흐름 여섯을 붙이는 동안 어느 쪽인지 매번 코드를 읽어야 한다.
  it('고장과 다른 것으로 구분된다', async () => {
    back = useServer({ baseUrl: '', fetch: async () => new Response('nope', { status: 500 }) })
    const broken = await runMutation('org.create', {}).catch((thrown: unknown) => thrown)
    expect(broken).toBeInstanceOf(Error)
    expect(broken).not.toBeInstanceOf(NotServedYet)
  })

  // 서버를 안 켠 동안(검사·개발용 대역)은 그대로 대역이 답한다. 그 자리까지 막으면
  // 화면 여든이 통째로 안 그려진다.
  it('서버를 안 켰으면 대역이 그대로 답한다', async () => {
    await expect(runMutation('meeting.create', {})).resolves.toEqual({})
  })
})

describe('보는 사람이 바뀌면 담아 둔 것을 놓는다', () => {
  // **칸 이름에 신원이 없었다.** 출처와 인자만으로 담았으니 신원이 바뀌어도
  // 앞사람의 값이 그대로 읽혔다 — 조직을 바꾸면 남의 학생회 것이 화면에 남는다.
  //
  // 지금은 일어날 수 없다(나가는 자리도 조직을 바꾸는 자리도 명세에 없다).
  // **그래서 이것은 고침이 아니라 자물쇠다** — 그 화면이 생기는 날 조용히 새지
  // 않게. 교차검토가 짚었다(2026-09-05).
  it('앞사람의 값이 다음 사람에게 안 남는다', async () => {
    let answers = 0
    back = useServer({
      baseUrl: '',
      fetch: async () => {
        answers += 1
        return Response.json({ name: `학생회 ${answers}` })
      },
    })

    servingAs('ORG-A')
    await loadSources([{ key: 'shell.organization', params: {} }])
    const first = readObjectSource('shell.organization')

    servingAs('ORG-B')
    // **다시 물어야 한다.** 안 물으면 앞사람의 답이 그대로 온다.
    await loadSources([{ key: 'shell.organization', params: {} }])
    expect(readObjectSource('shell.organization')).not.toEqual(first)
    expect(answers).toBe(2)
  })

  it('같은 사람이면 다시 묻지 않는다', async () => {
    let answers = 0
    back = useServer({
      baseUrl: '',
      fetch: async () => {
        answers += 1
        return Response.json({ name: `학생회 ${answers}` })
      },
    })
    servingAs('ORG-A')
    await loadSources([{ key: 'shell.organization', params: {} }])
    servingAs('ORG-A')
    await loadSources([{ key: 'shell.organization', params: {} }])
    expect(answers).toBe(1)
  })
})
