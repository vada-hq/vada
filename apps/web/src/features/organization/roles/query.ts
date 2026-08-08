import { queryOptions } from "@tanstack/react-query";

import { requestJson } from "../../../shared/api/failure";

/**
 * 계약 CB-ORG-001@R1의 두 동작이다.
 * 생성 클라이언트가 이 계약을 포함하면 여기 타입을 그것으로 교체한다.
 */
export type MemberRole = "president" | "department_head" | "member";

export interface MemberRoleRow {
  membershipId: string;
  /** 표시 전용. 이것으로 구성원을 가리키지 않는다. */
  displayName: string;
  departments: string[];
  role: MemberRole;
}

export interface MemberRoles {
  members: MemberRoleRow[];
}

export const roleLabels: Record<MemberRole, string> = {
  president: "회장단",
  department_head: "부서장",
  member: "부원",
};

export function memberRolesQueryKey() {
  return ["organization", "member-roles"] as const;
}

export function memberRolesQueryOptions() {
  return queryOptions({
    queryKey: memberRolesQueryKey(),
    retry: false,
    // 회장단이 여럿일 수 있다. 열 때마다 다시 읽는다.
    staleTime: 0,
    queryFn: ({ signal }) => requestJson<MemberRoles>("/organization/member-roles", { signal }),
  });
}

export async function changeMemberRole(
  membershipId: string,
  role: MemberRole,
  expectedCurrentRole: MemberRole,
) {
  return requestJson<MemberRoles>(
    `/organization/memberships/${encodeURIComponent(membershipId)}/role`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      // 화면이 본 현재 역할을 함께 보낸다. 그 사이 바뀌었으면 덮어쓰지 않는다.
      body: JSON.stringify({ role, expectedCurrentRole }),
    },
  );
}
