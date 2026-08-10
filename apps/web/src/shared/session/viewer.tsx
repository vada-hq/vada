import { useQuery } from "@tanstack/react-query";

import { sessionViewerQueryOptions } from "./query";

/**
 * 셸이 보여 주는 "나". 승인 와이어프레임 DesktopShell의 두 자리다 —
 * 사이드바 머리의 조직 이름과 사이드바 발치의 내 이름.
 *
 * **와이어프레임과 다르게 하는 것:** 와이어프레임은 이름 아래에 `부서 · 직급`을
 * 적는다. 우리는 적지 않는다. 계약 DATA:session.viewer@R1이 역할 이름을
 * 내려보내지 않기로 정했다 — 화면이 역할을 받으면 그것으로 다시 권한을 판정하고
 * 싶어지고, 그때 같은 규칙이 서버와 화면 양쪽에 생겨 언젠가 갈라진다.
 *
 * 와이어프레임의 조직 이름은 고정 문자열이다. 그것을 그대로 옮기면 어느 학생회가
 * 열어도 같은 이름이 나온다. 서버가 준 것으로 그린다.
 *
 * 실패해도 화면을 무너뜨리지 않는다. 셸은 모든 화면을 감싸므로 여기서 던지면
 * 아무것도 안 보인다. 대신 **지어내지도 않는다** — 못 읽었으면 못 읽었다고 적는다.
 */
export function OrganizationName() {
  const viewer = useQuery(sessionViewerQueryOptions());

  return (
    <span className="block truncate text-caption text-muted-foreground">
      {viewer.data?.organizationName ?? " "}
    </span>
  );
}

export function ViewerBadge() {
  const viewer = useQuery(sessionViewerQueryOptions());

  return (
    <div className="flex items-center gap-snug border-t border-border px-base py-snug">
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-medium text-muted-foreground"
      >
        {viewer.data ? viewer.data.displayName.slice(0, 1) : ""}
      </span>

      <span className="flex min-w-0 flex-col">
        {viewer.isPending ? (
          <span className="text-caption text-muted-foreground">
            불러오는 중…
          </span>
        ) : viewer.data ? (
          <span className="truncate text-label font-medium">
            {viewer.data.displayName}
          </span>
        ) : (
          <span className="text-caption text-muted-foreground">
            내 정보를 불러오지 못했습니다.
          </span>
        )}
      </span>
    </div>
  );
}
