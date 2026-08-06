import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PurchaseRequestOwnList } from "@vada/api-client";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatAmount, formatCreatedDate, formatStatus } from "./display";
import { EventFinanceLink } from "./navigation";
import { OwnListError, ownListQueryOptions } from "./own-list-query";

type OwnListItem = PurchaseRequestOwnList["items"][number];

const columns = ["요청 번호", "요청 제목", "요청액", "요청일", "상태"];

function OwnListRow({ eventId, item }: { eventId: string; item: OwnListItem }) {
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {item.requestId}
      </td>
      <td className="px-4 py-3">
        <Link
          className="font-medium underline-offset-2 hover:underline focus-visible:outline-2"
          params={{ eventId, requestId: item.requestId }}
          to="/events/$eventId/purchase-requests/$requestId"
        >
          {item.title}
        </Link>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatAmount(item.estimatedTotal)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatCreatedDate(item.createdAt)}
      </td>
      <td className="px-4 py-3">
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="info">{formatStatus(item.status)}</StatusBadge>
          {item.overBudget ? (
            <StatusBadge tone="warning">예산 초과</StatusBadge>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

export function PurchaseRequestOwnListScreen({
  eventId,
  submitted,
}: {
  eventId: string;
  submitted?: { overBudget: boolean };
}) {
  const query = useQuery(ownListQueryOptions(eventId));
  // 재시도 성공을 알리려면 사용자가 재시도했다는 사실을 직접 기억해야 한다.
  // TanStack Query의 failureCount는 성공 시 초기화된다.
  const [retried, setRetried] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      {/* 와이어프레임 머리말 위계: 왼쪽 제목·범위 설명, 오른쪽 주요 행동 */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">내 구매 요청</h1>
          <p className="text-sm text-muted-foreground">
            이 행사에서 내가 제출한 구매 요청
          </p>
          <EventFinanceLink eventId={eventId} />
        </div>
        {/*
          새 구매 요청 행동은 COMPARE-001에 따라 작성 맥락 조회가 성공한 사용자에게만
          노출한다. 작성 화면과 맥락 조회는 WORK:purchase-request-editor-ui@R2에서
          구현하므로 지금은 어떤 사용자에게도 노출하지 않는다.
        */}
      </header>

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
        <p role="status">요청 목록을 불러오는 중입니다.</p>
      ) : null}

      {query.isError ? (
        <OwnListFailureView
          error={query.error}
          onRetry={() => {
            setRetried(true);
            void query.refetch();
          }}
        />
      ) : null}

      {query.isSuccess && query.data.items.length === 0 ? (
        <Card>
          <p role="status">아직 제출한 구매 요청이 없습니다.</p>
        </Card>
      ) : null}

      {query.isSuccess && query.data.items.length > 0 ? (
        <>
          {retried ? (
            <p className="sr-only" role="status">
              목록을 다시 불러왔습니다.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-md border border-border">
            <table aria-label="본인 구매 요청" className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  {columns.map((column) => (
                    <th
                      className={
                        column === "요청액" ? "px-4 py-3 text-right" : "px-4 py-3"
                      }
                      key={column}
                      scope="col"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <OwnListRow eventId={eventId} item={item} key={item.requestId} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </main>
  );
}

function OwnListFailureView({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const failure =
    error instanceof OwnListError ? error.failure : "unavailable_permanently";

  if (failure === "unauthenticated") {
    return (
      <Alert tone="danger" title="다시 인증해야 합니다.">
        세션이 만료되어 요청 목록을 표시할 수 없습니다.
      </Alert>
    );
  }

  if (failure === "unavailable_temporarily") {
    return (
      <Alert tone="danger" title="목록을 일시적으로 불러오지 못했습니다.">
        <p>잠시 후 다시 시도해 주세요.</p>
        <Button className="mt-2" onClick={onRetry} type="button">
          다시 시도
        </Button>
      </Alert>
    );
  }

  return (
    <Alert tone="danger" title="목록을 볼 수 없습니다.">
      이 행사의 구매 요청 목록에 접근할 수 없습니다.
    </Alert>
  );
}
