/**
 * 서버 API의 기본 경로다.
 *
 * 화면 주소와 API 경로가 그대로 겹친다. `/events/event-001/purchase-requests/mine`은
 * 브라우저가 여는 화면이면서 동시에 서버 엔드포인트다. 접두사로 갈라야 둘 다 살 수 있다.
 *
 * 버전을 URL에 두는 이유는 모바일 때문이다. 웹은 API와 같이 배포되지만 모바일은
 * 사용자가 업데이트하지 않으면 옛 경로로 계속 호출한다. 계약 리비전(`@R2`)이 실제
 * 진화를 담당하고 `additive-only` 규칙이 파괴적 변경을 막으므로, 이 값은 대체로
 * `v1`에 머문다. 쓰이지 않는 안전망이지 진화 수단이 아니다.
 *
 * 이 접두사는 배포 라우팅 사실이지 계약이 아니다. 계약의 `paths`는 접두사 없이
 * 그대로 두고, 로컬에서는 vite 프록시가, 배포에서는 API Gateway가 이 자리를 맡는다.
 */
export const API_BASE_PATH = "/api/v1";

export function apiPath(path: string): string {
  return `${API_BASE_PATH}${path}`;
}
