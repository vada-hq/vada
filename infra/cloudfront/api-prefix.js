// 화면 주소와 API 경로가 겹치므로 접두사로 가른다. 여기가 배포에서 그것을
// 벗기는 자리다 — 로컬에서 vite 프록시가 하는 일과 같다.
//
// 서버는 접두사를 모른다. 계약의 `paths`는 접두사 없이 그대로이고, 접두사는
// 배포 라우팅 사실이라 어느 계약도 소유하지 않는다.
//
// 이 값이 `apps/web/src/shared/api/base.ts`와 어긋나면 배포된 화면의 모든
// 요청이 404가 된다. 로컬은 멀쩡한 채로. `scripts/check-api-prefix.mjs`가 본다.
var PREFIX = "/api/v1";

function handler(event) {
  var request = event.request;

  if (request.uri.startsWith(PREFIX)) {
    request.uri = request.uri.slice(PREFIX.length) || "/";
  }

  return request;
}
