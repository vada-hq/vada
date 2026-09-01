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
    forwarded.headers.set('x-forwarded-host', incoming.host)
    forwarded.headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))
    return fetch(forwarded)
  },
}
