import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { PurchaseRequestOwnList } from "@vada/api-client";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { StatusBadge } from "../../components/ui/status-badge";
import { OwnListError, ownListQueryOptions } from "./own-list-query";

type OwnListItem = PurchaseRequestOwnList["items"][number];

const statusLabels: Record<string, string> = {
  review_pending: "검토 대기",
};

const amountFormat = new Intl.NumberFormat("ko-KR");

function formatAmount(value: number) {
  return `${amountFormat.format(value)}원`;
}

/** 저장은 UTC, 표시는 KST 날짜만 사용한다. */
function formatCreatedDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(parsed)
    .replaceAll(". ", "-")
    .replace(".", "");
}

function OwnListRow({ eventId, item }: { eventId: string; item: OwnListItem }) {
  return (
    <li className="rounded-md border border-border">
      <Link
        className="flex flex-col gap-2 px-4 py-3 focus-visible:outline-2"
        params={{ eventId, requestId: item.requestId }}
        to="/events/$eventId/purchase-requests/$requestId"
      >
        <span className="font-medium">{item.title}</span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge tone="info">
            {statusLabels[item.status] ?? item.status}
          </StatusBadge>
          {item.overBudget ? (
            <StatusBadge tone="warning">예산 초과</StatusBadge>
          ) : null}
          <span>{formatAmount(item.estimatedTotal)}</span>
          <span>{formatCreatedDate(item.createdAt)}</span>
        </span>
      </Link>
    </li>
  );
}

export function PurchaseRequestOwnListScreen({ eventId }: { eventId: string }) {
  const query = useQuery(ownListQueryOptions(eventId));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">내 구매 요청</h1>

      {query.isPending ? (
        <p role="status">요청 목록을 불러오는 중입니다.</p>
      ) : null}

      {query.isError ? <OwnListFailureView eventId={eventId} error={query.error} onRetry={() => void query.refetch()} /> : null}

      {query.isSuccess && query.data.items.length === 0 ? (
        <Card>
          <p>아직 제출한 구매 요청이 없습니다.</p>
        </Card>
      ) : null}

      {query.isSuccess && query.data.items.length > 0 ? (
        <ul aria-label="본인 구매 요청" className="flex flex-col gap-2">
          {query.data.items.map((item) => (
            <OwnListRow eventId={eventId} item={item} key={item.requestId} />
          ))}
        </ul>
      ) : null}
    </main>
  );
}

function OwnListFailureView({
  eventId,
  error,
  onRetry,
}: {
  eventId: string;
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
      <p>이 행사의 구매 요청 목록에 접근할 수 없습니다.</p>
      {/* 행사 재정 화면은 DU-001 범위 밖이라 라우트를 만들지 않고 경로만 연결한다. */}
      <a
        className="mt-2 inline-block underline"
        href={`/events/${encodeURIComponent(eventId)}/finance`}
      >
        행사 재정으로 돌아가기
      </a>
    </Alert>
  );
}
