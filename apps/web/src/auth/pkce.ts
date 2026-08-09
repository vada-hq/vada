/**
 * PKCE — 인가 코드를 가로챈 쪽이 그것을 토큰으로 바꾸지 못하게 한다.
 *
 * 브라우저에서 도는 앱에는 클라이언트 비밀이 없다. 넣어 두면 개발자 도구로
 * 꺼내진다. 비밀이 없으면 코드만 가진 쪽도 토큰을 받을 수 있으므로, 코드를
 * 시작한 브라우저만 아는 값(verifier)을 만들어 두고 교환할 때 같이 낸다.
 * 로그인 화면으로는 그 값의 **해시**만 보내므로 도중에 봐도 쓸 수 없다.
 *
 * RFC 7636. 방식은 S256만 쓴다 — `plain`은 해시를 안 해서 막는 것이 없다.
 */

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // URL에 실려 가므로 `+/=`를 그대로 둘 수 없다.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 추측할 수 없는 값. `Math.random()`을 쓰지 않는다 — 그것은 예측 가능하고,
 * 예측 가능한 verifier는 PKCE가 막으려던 것을 그대로 통과시킨다.
 */
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}
