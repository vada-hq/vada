import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { PurchaseRequestOwnList } from "@vada/api-client";
import { useState } from "react";

import { Alert } from "../../../components/ui/alert";
import { StatusBadge } from "../../../components/ui/status-badge";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import {
  EmptyState,
  FailureState,
  LoadingState,
} from "../../../shared/screen/states";
import { DataTable } from "../../../shared/ui/data-table";
import { Page, PageHeader } from "../../../shared/ui/page";
import { formatAmount, formatCreatedDate, formatStatus } from "../shared/display";
import { EventFinanceLink } from "../shared/navigation";
import { ownListQueryOptions } from "./query";

type OwnListItem = PurchaseRequestOwnList["items"][number];

function describeFailure(failure: ApiFailure) {
  if (failure === "unauthenticated") {
    return {
      title: "다시 인증해야 합니다.",
      description: "세션이 만료되어 요청 목록을 표시할 수 없습니다.",
    };
  }
  if (failure === "unavailable_temporarily") {
    return {
      title: "목록을 일시적으로 불러오지 못했습니다.",
      description: "잠시 후 다시 시도해 주세요.",
    };
  }
  // 권한 없음과 찾을 수 없음은 다른 조직 데이터의 존재를 노출하지 않는다.
  return {
    title: "목록을 볼 수 없습니다.",
    description: "이 행사의 구매 요청 목록에 접근할 수 없습니다.",
  };
}

export function PurchaseRequestOwnListScreen({
  eventId,
  submitted,
}: {
  eventId: string;
  submitted?: { overBudget: boolean };
}) {
  const query = useQuery(ownListQueryOptions(eventId));
  // TanStack Query의 failureCount는 성공 시 초기화되므로 직접 기억한다.
  const [retried, setRetried] = useState(false);

  const columns = [
    {
      key: "requestId",
      header: "요청 번호",
      cell: (row: OwnListItem) => (
        <span className="font-mono text-label text-muted-foreground">
          {row.requestId}
        </span>
      ),
    },
    {
      key: "title",
      header: "요청 제목",
      cell: (row: OwnListItem) => (
        <Link
          className="font-medium underline-offset-2 hover:underline focus-visible:outline-2"
          params={{ eventId, requestId: row.requestId }}
          to="/events/$eventId/purchase-requests/$requestId"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: "estimatedTotal",
      header: "요청액",
      align: "end" as const,
      cell: (row: OwnListItem) => formatAmount(row.estimatedTotal),
    },
    {
      key: "createdAt",
      header: "요청일",
      cell: (row: OwnListItem) => (
        <span className="text-muted-foreground">
          {formatCreatedDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      cell: (row: OwnListItem) => (
        <span className="flex flex-wrap items-center gap-tight">
          <StatusBadge tone="info">{formatStatus(row.status)}</StatusBadge>
          {row.overBudget ? (
            <StatusBadge tone="warning">예산 초과</StatusBadge>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        actions={
          <Link
            className="rounded-sm bg-primary px-snug py-tight text-body text-primary-foreground"
            params={{ eventId }}
            to="/events/$eventId/purchase-requests/new"
          >
            새 구매 요청
          </Link>
        }
        description="이 행사에서 내가 제출한 구매 요청"
        title="내 구매 요청"
      />
      <EventFinanceLink eventId={eventId} />

      {submitted ? (
        <Alert
          tone={submitted.overBudget ? "danger" : "info"}
          title="요청이 제출되었습니다."
        >
          <p>재정부 검토 대기 상태로 저장됐습니다.</p>
          {submitted.overBudget ? (
            <p>예산 초과 — 승인 전 해결이 필요합니다.</p>
          ) : null}
        </Alert>
      ) : null}

      {query.isPending ? (
        <LoadingState label="요청 목록을 불러오는 중입니다." />
      ) : null}

      {query.isError ? (
        <FailureState
          describe={describeFailure}
          failure={failureOf(query.error)}
          onRetry={() => {
            setRetried(true);
            void query.refetch();
          }}
        />
      ) : null}

      {query.isSuccess && query.data.items.length === 0 ? (
        <EmptyState>아직 제출한 구매 요청이 없습니다.</EmptyState>
      ) : null}

      {query.isSuccess && query.data.items.length > 0 ? (
        <>
          {retried ? (
            <p className="sr-only" role="status">
              목록을 다시 불러왔습니다.
            </p>
          ) : null}
          <DataTable
            columns={columns}
            label="본인 구매 요청"
            rowKey={(row) => row.requestId}
            rows={query.data.items}
          />
        </>
      ) : null}
    </Page>
  );
}
