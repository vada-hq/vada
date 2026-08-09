// SPA는 HTML 파일 하나뿐이다. 그런데 사용자는 `/organization/roles`를 주소창에
// 직접 치고, 즐겨찾기에 넣고, 링크로 공유한다. S3에는 그런 키가 없으니 그대로
// 두면 403이다 — 앱은 멀쩡한데 새로고침만 하면 깨진다.
//
// 그래서 파일을 가리키지 않는 주소는 전부 앱에게 준다. 어느 화면인지는 브라우저
// 안의 라우터가 정한다.
//
// 배포 전체에 오류 페이지를 index.html로 바꾸는 방법(custom_error_response)을
// 쓰지 않는다. 그것은 배포 단위라 API의 404까지 HTML로 바꿔 버린다 — 서버가
// problem+json으로 답한 것이 화면 HTML이 되어 돌아온다.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // 마지막 조각만 본다. `/events/e-1/purchase-requests/mine`의 `mine`처럼
  // 확장자가 없으면 화면이고, `/assets/index-a1b2c3.js`처럼 있으면 파일이다.
  var lastSegment = uri.slice(uri.lastIndexOf("/") + 1);

  if (lastSegment.indexOf(".") === -1) {
    request.uri = "/index.html";
  }

  return request;
}
