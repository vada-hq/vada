// `/api/*`를 api 서버로 넘긴다.
//
// **한 주소에 있게 하려는 것이다.** 웹과 api가 다른 사이트에 있으면 세션 쿠키가
// 서드파티 쿠키가 되고, 브라우저가 그것을 막는다 — Safari는 이미 막고 Chrome도
// 줄이는 중이다. 그러면 로그인은 되는데 그다음 요청마다 로그인하지 않은 사람으로
// 보이는, 가장 헷갈리는 고장이 난다.
//
// 여기를 거치면 브라우저가 보기에 api는 웹과 **같은 주소**다. CORS도 필요 없고
// 쿠키도 평범한 첫 파티 쿠키가 된다.
//
// 도메인을 사서 `vada.app`과 `api.vada.app`으로 나누면 이 파일이 필요 없어진다 —
// 그때는 같은 사이트라 쿠키가 그냥 따라간다.

interface Env {
  /** api가 실제로 도는 곳. 예: https://vada-api.fly.dev */
  API_ORIGIN: string
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const origin = env.API_ORIGIN
  if (!origin) {
    // 지어내지 않는다. 어디로 넘길지 모르면 그 사실을 말한다.
    return new Response('API_ORIGIN이 설정되지 않았습니다.', { status: 500 })
  }
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, origin)

  // 원래 요청을 그대로 넘긴다. 몸통도 쿠키도 헤더도 손대지 않는다 —
  // 손대는 순간 여기가 판정하는 자리가 되고, 그 판정은 아무도 검사하지 않는다.
  const forwarded = new Request(target, request)
  // 서버가 '어디서 온 요청인가'를 볼 수 있게 원래 주소를 남긴다.
  forwarded.headers.set('x-forwarded-host', incoming.host)
  forwarded.headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))
  return fetch(forwarded)
}
