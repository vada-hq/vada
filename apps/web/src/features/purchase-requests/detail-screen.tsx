import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { PurchaseRequestDetailView } from "@vada/api-client";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { StatusBadge } from "../../components/ui/status-badge";
import { DetailError, detailQueryOptions } from "./detail-query";
import { formatAmount, formatCreatedDate, formatStatus } from "./display";

type DetailRecord = PurchaseRequestDetailView["record"];
type DetailItem = DetailRecord["content"]["items"][number];

function itemAmount(record: DetailRecord, position: number) {
  return record.itemResults.find((result) => result.itemPosition === position)
    ?.estimatedAmount;
}

function ItemRow({
  amount,
  item,
}: {
  amount: number | undefined;
  item: DetailItem;
}) {
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border px-4 py-3">
      <span className="font-medium">{item.name}</span>
      <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{item.category}</span>
        <span>
          {item.quantity}
          {item.unit}
        </span>
        {amount === undefined ? null : <span>{formatAmount(amount)}</span>}
      </span>
    </li>
  );
}

export function PurchaseRequestDetailScreen({
  eventId,
  requestId,
}: {
  eventId: string;
  requestId: string;
}) {
  const query = useQuery(detailQueryOptions(eventId, requestId));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10">
      {query.isPending ? (
        <p role="status">요청 상세를 불러오는 중입니다.</p>
      ) : null}

      {query.isError ? (
        <DetailFailureView
          error={query.error}
          eventId={eventId}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.isSuccess ? (
        <DetailContent view={query.data} />
      ) : null}
    </main>
  );
}

function DetailContent({ view }: { view: PurchaseRequestDetailView }) {
  const { display, record } = view;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {record.content.title}
      </h1>

      <Card>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">행사</dt>
            {/* 서버가 해석한 표시명만 쓰고 식별자에서 이름을 추정하지 않는다. */}
            <dd>{display.eventName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">요청자</dt>
            <dd>{display.requesterName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">상태</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="info">{formatStatus(record.status)}</StatusBadge>
              {record.overBudget ? (
                <StatusBadge tone="warning">예산 초과</StatusBadge>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">신청일</dt>
            <dd>{formatCreatedDate(record.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">합계</dt>
            <dd>{formatAmount(record.estimatedTotal)}</dd>
          </div>
        </dl>
      </Card>

      <h2 className="text-lg font-semibold">품목</h2>
      <ul aria-label="품목" className="flex flex-col gap-2">
        {record.content.items.map((item, position) => (
          <ItemRow
            amount={itemAmount(record, position)}
            item={item}
            key={`${item.name}-${position}`}
          />
        ))}
      </ul>
    </>
  );
}

function OwnListLink({ eventId }: { eventId: string }) {
  return (
    <Link
      className="mt-2 inline-block underline"
      params={{ eventId }}
      to="/events/$eventId/purchase-requests/mine"
    >
      내 구매 요청 목록으로
    </Link>
  );
}

function DetailFailureView({
  error,
  eventId,
  onRetry,
}: {
  error: unknown;
  eventId: string;
  onRetry: () => void;
}) {
  const failure = error instanceof DetailError ? error.failure : "not_found";

  if (failure === "unauthenticated") {
    return (
      <Alert tone="danger" title="다시 인증해야 합니다.">
        세션이 만료되어 요청 상세를 표시할 수 없습니다.
      </Alert>
    );
  }

  if (failure === "unavailable_temporarily") {
    return (
      <Alert tone="danger" title="상세를 일시적으로 불러오지 못했습니다.">
        <p>잠시 후 다시 시도해 주세요.</p>
        <Button className="mt-2" onClick={onRetry} type="button">
          다시 시도
        </Button>
        <OwnListLink eventId={eventId} />
      </Alert>
    );
  }

  return (
    <Alert tone="danger" title="요청을 찾을 수 없습니다.">
      <p>이미 삭제되었거나 접근할 수 없는 요청입니다.</p>
      <OwnListLink eventId={eventId} />
    </Alert>
  );
}
