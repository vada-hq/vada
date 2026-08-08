/**
 * 목으로 돌지 말지는 **모드 이름**이 정한다.
 *
 * 전에는 `.env.mock`의 플래그가 정했다. 그 파일은 `.gitignore`의 `.env.*`에
 * 걸려 커밋되지 않았고, 그래서 저장소를 새로 받은 기계에서는 목이 조용히
 * 꺼졌다 — 오류 없이 화면만 비었다. CI에서 브라우저 검사를 돌리자마자
 * 7건이 전부 그 이유로 실패했다.
 *
 * 모드 이름은 `just dev-web-mock`이 명령줄로 넘기므로 사라질 수 없다.
 * 배포 빌드에서는 DEV가 거짓이라 어느 쪽이든 켜지지 않는다.
 */
export async function enableApiMocking() {
  if (!import.meta.env.DEV || import.meta.env.MODE !== "mock") {
    return;
  }

  const { worker } = await import("./browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}
