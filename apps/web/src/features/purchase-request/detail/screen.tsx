import { useQuery } from "@tanstack/react-query";
import type { PurchaseRequestDetailView } from "@vada/api-client";

import { Card } from "../../../components/ui/card";
import { StatusBadge } from "../../../components/ui/status-badge";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import { FailureState, LoadingState } from "../../../shared/screen/states";
import { DataTable } from "../../../shared/ui/data-table";
import { Page } from "../../../shared/ui/page";
import { formatAmount, formatCreatedDate, formatStatus } from "../shared/display";
import { OwnListLink } from "../shared/navigation";
import { detailQueryOptions } from "./query";

type DetailRecord = PurchaseRequestDetailView["record"];
type DetailItem = DetailRecord["content"]["items"][number];

function describeFailure(failure: ApiFailure) {
  if (failure === "unauthenticated") {
    return {
      title: "다시 인증해야 합니다.",
      description: "세션이 만료되어 요청 상세를 표시할 수 없습니다.",
    };
  }
  if (failure === "unavailable_temporarily") {
    return {
      title: "상세를 일시적으로 불러오지 못했습니다.",
      description: "잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    title: "요청을 찾을 수 없습니다.",
    description: "이미 삭제되었거나 접근할 수 없는 요청입니다.",
  };
}

function itemAmount(record: DetailRecord, position: number) {
  return record.itemResults.find((result) => result.itemPosition === position)
    ?.estimatedAmount;
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
    <Page>
      {query.isPending ? (
        <LoadingState label="요청 상세를 불러오는 중입니다." />
      ) : null}

      {query.isError ? (
        <FailureState
          actions={<OwnListLink eventId={eventId} />}
          describe={describeFailure}
          failure={failureOf(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.isSuccess ? (
        <>
          <p className="sr-only" role="status">
            요청 상세를 불러왔습니다.
          </p>
          <DetailContent eventId={eventId} view={query.data} />
        </>
      ) : null}
    </Page>
  );
}

function DetailContent({
  eventId,
  view,
}: {
  eventId: string;
  view: PurchaseRequestDetailView;
}) {
  const { display, record } = view;

  const attributes: Array<[string, string]> = [
    ["행사", display.eventName],
    ["요청자", display.requesterName],
    ["신청일", formatCreatedDate(record.createdAt)],
    ["예산", record.overBudget ? "초과" : "정상"],
  ];

  const columns = [
    {
      key: "name",
      header: "품목",
      cell: (item: DetailItem) => item.name,
    },
    {
      key: "quantity",
      header: "수량",
      cell: (item: DetailItem) => (
        <span className="text-muted-foreground">
          {item.quantity}
          {item.unit}
        </span>
      ),
    },
    {
      key: "amount",
      header: "금액",
      align: "end" as const,
      cell: (item: DetailItem) => {
        const amount = itemAmount(record, record.content.items.indexOf(item));
        return amount === undefined ? "—" : formatAmount(amount);
      },
    },
  ];

  return (
    <>
      {/* 와이어프레임 요약 카드 위계: 왼쪽 식별자·상태·제목, 오른쪽 강조된 요청액 */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-base">
          <div className="flex flex-col gap-tight">
            <span className="flex flex-wrap items-center gap-tight">
              <span className="font-mono text-label text-muted-foreground">
                {record.requestId}
              </span>
              <StatusBadge tone="info">{formatStatus(record.status)}</StatusBadge>
              {record.overBudget ? (
                <StatusBadge tone="warning">예산 초과</StatusBadge>
              ) : null}
            </span>
            <h1 className="text-display font-semibold tracking-tight">
              {record.content.title}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-label text-muted-foreground">전체 요청액</p>
            <p className="text-title font-semibold tabular-nums">
              {formatAmount(record.estimatedTotal)}
            </p>
          </div>
        </div>

        <dl className="mt-loose grid gap-base border-t border-border pt-loose sm:grid-cols-4">
          {attributes.map(([label, value]) => (
            <div key={label}>
              <dt className="text-label text-muted-foreground">{label}</dt>
              {/* 서버가 해석한 표시명만 쓰고 식별자에서 이름을 추정하지 않는다. */}
              <dd className="text-body">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <DataTable
        columns={columns}
        label="품목"
        rowKey={(item) => `${item.name}-${record.content.items.indexOf(item)}`}
        rows={record.content.items}
      />

      <OwnListLink eventId={eventId} />
    </>
  );
}
