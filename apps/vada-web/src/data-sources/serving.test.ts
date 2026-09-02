import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fetchOptions } from '../option-sources/catalog'
import {
  SourcesFailed,
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

  // 아직 안 붙은 목록은 서버를 켜도 개발용 응답이다. 둘 다 적힌 상태다(`served.ts`).
  it('진짜에 없는 목록은 서버를 부르지 않는다', async () => {
    let called = false
    back = useServer({
      baseUrl: '',
      fetch: async () => {
        called = true
        return Response.json([])
      },
    })
    expect(await fetchOptions('finance.purchaseTypes', {})).not.toEqual([])
    expect(called).toBe(false)
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
