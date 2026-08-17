# Spec Service

Figma 플러그인과 저장소의 화면 JSON을 연결하는 로컬 HTTP 브리지이다.
외부 서버나 Figma 계정 인증을 사용하지 않고 `127.0.0.1`에서만 실행한다.

## 실행

```powershell
Set-Location 'C:\Users\82108\figma-spec-v2\apps\spec-service'
npm start
```

서버 바인딩 주소는 `127.0.0.1:3846`, Figma 플러그인 접속 주소는
`http://localhost:3846`이고 저장 루트는 저장소의 `specs/figma`로 고정된다.

Figma에서 `이 화면 저장`을 사용하기 전에 이 프로세스가 실행 중이어야
한다. 플러그인은 Figma 내부 사본을 먼저 저장한 뒤 이 서비스에 같은
화면 JSON을 전송한다.

## API

- `GET /health`
- `GET /v1/option-sources/<wireframeKey>`
- `GET /v1/state-scopes/<wireframeKey>`
- `GET /v1/screens/<wireframeKey>/<screenId>`
- `PUT /v1/screens/<wireframeKey>/<screenId>`
- `OPTIONS` 요청은 Figma 플러그인의 CORS preflight를 위해 처리한다.

`PUT`은 `application/json`만 허용한다. URL의 `screenId`와 JSON 본문의
`screenId`가 같아야 하며, 저장 파일은
`specs/figma/<wireframeKey>/screens/<screenId>/screen.json`이다.

옵션 출처 GET은
`specs/figma/<wireframeKey>/option-sources.json`을 읽는다. 이 카탈로그는
선택 요소가 참조할 의미 key, 출처 type, 설명, 필요 인자와 정적 선택지를
wireframe 단위로 관리한다.

상태 스코프 GET은
`specs/figma/<wireframeKey>/state-scopes.json`을 읽는다. 이 카탈로그는
여러 화면이 공유하는 입력 상태의 생명주기와 제거 시점을 wireframe 단위로
관리한다.

화면 GET과 PUT은 파일 내용의 SHA-256을 인용한 `ETag` 헤더로 반환한다.
새 파일 저장은 `If-None-Match: *`, 기존 파일 갱신은 마지막 GET에서 받은
`If-Match`를 사용할 수 있다. 리비전이 다르면 `412 revision_conflict`를
반환하고 기존 로컬 파일을 유지한다.

## 확인

```powershell
npm test
```
