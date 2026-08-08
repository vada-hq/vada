import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert } from "../../../components/ui/alert";
import { Select } from "../../../components/ui/select";
import { StatusBadge } from "../../../components/ui/status-badge";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import { EmptyState, FailureState, LoadingState } from "../../../shared/screen/states";
import { DataTable } from "../../../shared/ui/data-table";
import { Page, PageHeader } from "../../../shared/ui/page";
import {
  changeMemberRole,
  memberRolesQueryKey,
  memberRolesQueryOptions,
  roleLabels,
  type MemberRole,
  type MemberRoleRow,
} from "./query";

interface AppliedChange {
  displayName: string;
  from: MemberRole;
  to: MemberRole;
}

function describeFailure(failure: ApiFailure) {
  if (failure === "unauthenticated") {
    return {
      title: "다시 인증해야 합니다.",
      description: "세션이 만료되어 구성원 명단을 표시할 수 없습니다.",
    };
  }
  if (failure === "conflict") {
    return {
      title: "그 사이 역할이 바뀌었습니다.",
      description:
        "다른 회장단이 먼저 바꿨거나 마지막 회장단이라 바꿀 수 없습니다. 다시 읽어 주세요.",
    };
  }
  if (failure === "unavailable_temporarily") {
    return {
      title: "구성원 명단을 일시적으로 불러오지 못했습니다.",
      description: "잠시 후 다시 시도해 주세요.",
    };
  }
  // 권한 없음과 찾을 수 없음은 다른 조직 데이터의 존재를 노출하지 않는다.
  return {
    title: "구성원 명단을 볼 수 없습니다.",
    description: "기본 역할 관리는 회장단만 할 수 있습니다.",
  };
}

const roleOptions: Array<{ value: MemberRole; label: string }> = [
  { value: "president", label: roleLabels.president },
  { value: "department_head", label: roleLabels.department_head },
  { value: "member", label: roleLabels.member },
];

export function OrganizationRolesScreen() {
  const query = useQuery(memberRolesQueryOptions());
  const queryClient = useQueryClient();
  const [applied, setApplied] = useState<AppliedChange | null>(null);

  const mutation = useMutation({
    mutationFn: ({ row, role }: { row: MemberRoleRow; role: MemberRole }) =>
      // 화면이 본 값을 함께 보낸다. 서버가 그것으로 낙관적 잠금을 건다.
      changeMemberRole(row.membershipId, role, row.role),
    onMutate: () => setApplied(null),
    onSuccess: (members, { row, role }) => {
      // 응답이 이미 바뀐 명단이다. 다시 읽으면 같은 왕복을 한 번 더 한다.
      queryClient.setQueryData(memberRolesQueryKey(), members);
      setApplied({ displayName: row.displayName, from: row.role, to: role });
    },
    // 거절당했으면 화면이 본 것이 낡았다는 뜻이다. 정본이 다시 읽으라고 한다.
    onError: () => queryClient.invalidateQueries({ queryKey: memberRolesQueryKey() }),
  });

  const failure = query.error ?? mutation.error;
  // 서버가 답할 때까지 이 줄만 잠근다. 값은 바꾸지 않는다 — 아직 사실이 아니다.
  const changing = mutation.isPending ? mutation.variables.row.membershipId : null;

  const columns = [
    {
      key: "displayName",
      header: "이름",
      cell: (row: MemberRoleRow) => <span className="font-medium">{row.displayName}</span>,
    },
    {
      key: "departments",
      header: "소속 부서",
      cell: (row: MemberRoleRow) =>
        row.departments.length > 0 ? (
          row.departments.join(" · ")
        ) : (
          // 미배정도 조직의 구성원이다. 빈 칸으로 두면 빠진 것처럼 보인다.
          <span className="text-muted-foreground">미배정</span>
        ),
    },
    {
      key: "role",
      header: "기본 역할",
      cell: (row: MemberRoleRow) => (
        <span className="flex flex-wrap items-center gap-snug">
          <StatusBadge tone={row.role === "president" ? "info" : "neutral"}>
            {roleLabels[row.role]}
          </StatusBadge>
          <Select
            aria-label={`${row.displayName} 기본 역할`}
            disabled={changing === row.membershipId}
            onValueChange={(value) => {
              mutation.mutate({ row, role: value as MemberRole });
            }}
            options={roleOptions}
            value={row.role}
          />
          {changing === row.membershipId ? (
            <span className="text-caption text-muted-foreground" role="status">
              적용 중
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        description="학생회 구성원의 기본 역할을 회장단이 바꿉니다"
        title="역할 및 권한 관리"
      />

      {query.isPending ? (
        <LoadingState label="구성원 명단을 불러오는 중입니다." />
      ) : null}

      {failure ? (
        <FailureState
          describe={describeFailure}
          failure={failureOf(failure)}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {applied ? (
        <Alert
          title={`${applied.displayName}의 기본 역할을 ${roleLabels[applied.from]}에서 ${roleLabels[applied.to]}으로 바꿨습니다.`}
        >
          맥락 역할은 바뀌지 않았습니다.
        </Alert>
      ) : null}

      {query.isSuccess && query.data.members.length === 0 ? (
        <EmptyState>아직 이 학생회에 구성원이 없습니다.</EmptyState>
      ) : null}

      {query.isSuccess && query.data.members.length > 0 ? (
        <DataTable
          columns={columns}
          label="구성원 기본 역할"
          rowKey={(row) => row.membershipId}
          rows={query.data.members}
        />
      ) : null}
    </Page>
  );
}
