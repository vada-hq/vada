// `/api/*`를 api 서버로 넘긴다.
//
// **한 주소에 있게 하려는 것이다.** 웹과 api가 다른 사이트에 있으면 세션 쿠키가
// 서드파티 쿠키가 되고 브라우저가 그것을 막는다 — Safari는 이미, Chrome도 줄이는
// 중이다. 그러면 로그인은 되는데 그다음 요청마다 로그인하지 않은 사람으로 보이는,
// 가장 헷갈리는 고장이 난다.
//
// 여기를 거치면 브라우저가 보기에 api는 웹과 같은 주소다.

interface Env {
  /** api가 실제로 도는 곳. 예: https://vada-api-amd7.onrender.com */
  API_ORIGIN: string
  /**
   * **여기를 거쳤다는 증거**(선택). `wrangler secret put EDGE_SECRET`으로 넣는다.
   *
   * api는 이 값이 맞을 때만 아래의 `x-forwarded-for`를 믿는다. 없으면 api가 헤더를
   * 그대로 믿고, 그러면 api 주소를 곧장 두드리며 매번 다른 주소를 적는 것으로
   * 속도 세기를 지나갈 수 있다 — 밖에서 열리는 자리의 유일한 벽이 그 세기다.
   *
   * **저장소에 두지 않는다.** `vars`가 아니라 비밀이다.
   */
  EDGE_SECRET?: string
  /** 정적 파일. `/api/` 밖은 여기로 간다. */
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url)
    if (!incoming.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }
    if (!env.API_ORIGIN) {
      // 지어내지 않는다. 어디로 넘길지 모르면 그 사실을 말한다.
      return new Response('API_ORIGIN이 설정되지 않았습니다.', { status: 500 })
    }

    const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN)
    // 원래 요청을 그대로 넘긴다. 몸통도 쿠키도 헤더도 손대지 않는다 — 손대는 순간
    // 여기가 판정하는 자리가 되고, 그 판정은 아무도 검사하지 않는다.
    const forwarded = new Request(target, request)

    // **보낸 사람의 주소를 잃지 않는다.**
    //
    // 여기를 거치면 서버가 보는 주소는 전부 Cloudflare의 것이 된다. 그러면 밖에서
    // 열리는 자리의 속도 세기가 **행사장 전체를 한 사람으로 센다** — 캠퍼스 NAT을
    // 걱정해 축을 둘로 나눠 둔 것이 통째로 무의미해진다.
    const client = request.headers.get('cf-connecting-ip')
    if (client !== null) forwarded.headers.set('x-forwarded-for', client)

    // **적은 것이 우리라는 증거를 함께 싣는다.**
    //
    // 위의 주소는 보내는 쪽이 쓰는 글자라 아무나 아무 값이나 적을 수 있고, api가
    // 도는 곳은 밖에서도 열려 있다. 증거가 없으면 api는 그 헤더를 못 믿는다.
    //
    // **밖에서 온 것은 지운다.** 안 지우면 곧장 두드리는 쪽이 이 헤더를 스스로
    // 적어 넣어 증거를 위조한다.
    forwarded.headers.delete('x-vada-edge')
    if (env.EDGE_SECRET) forwarded.headers.set('x-vada-edge', env.EDGE_SECRET)
    forwarded.headers.set('x-forwarded-host', incoming.host)
    forwarded.headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))
    return fetch(forwarded)
  },
}
