import { useQuery } from "@tanstack/react-query";
import type { PurchaseRequestDetailView } from "@vada/api-client";
import { useEffect, useRef } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { StatusBadge } from "../../components/ui/status-badge";
import { DetailError, detailQueryOptions } from "./detail-query";
import { formatAmount, formatCreatedDate, formatStatus } from "./display";
import { OwnListLink } from "./navigation";

type DetailRecord = PurchaseRequestDetailView["record"];

const itemColumns = ["품목", "수량", "금액"];

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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
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
        <>
          <p className="sr-only" role="status">
            요청 상세를 불러왔습니다.
          </p>
          <DetailContent eventId={eventId} view={query.data} />
        </>
      ) : null}
    </main>
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

  return (
    <>
      {/* 와이어프레임 요약 카드 위계: 왼쪽 식별자·상태·제목, 오른쪽 강조된 요청액 */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {record.requestId}
              </span>
              <StatusBadge tone="info">{formatStatus(record.status)}</StatusBadge>
              {record.overBudget ? (
                <StatusBadge tone="warning">예산 초과</StatusBadge>
              ) : null}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {record.content.title}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">전체 요청액</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatAmount(record.estimatedTotal)}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-4">
          {attributes.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              {/* 서버가 해석한 표시명만 쓰고 식별자에서 이름을 추정하지 않는다. */}
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="overflow-x-auto rounded-md border border-border">
        <table aria-label="품목" className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-left text-xs text-muted-foreground">
              {itemColumns.map((column) => (
                <th
                  className={
                    column === "금액" ? "px-4 py-3 text-right" : "px-4 py-3"
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
            {record.content.items.map((item, position) => {
              const amount = itemAmount(record, position);

              return (
                <tr
                  className="border-t border-border"
                  key={`${item.name}-${position}`}
                >
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.quantity}
                    {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {amount === undefined ? "—" : formatAmount(amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OwnListLink eventId={eventId} />
    </>
  );
}

/** 명세 R3는 상세 실패 시 오류 제목에 논리적 포커스를 두도록 요구한다. */
function useErrorTitleFocus() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
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
  const titleRef = useErrorTitleFocus();

  const title =
    failure === "unauthenticated"
      ? "다시 인증해야 합니다."
      : failure === "unavailable_temporarily"
        ? "상세를 일시적으로 불러오지 못했습니다."
        : "요청을 찾을 수 없습니다.";

  const description =
    failure === "unauthenticated"
      ? "세션이 만료되어 요청 상세를 표시할 수 없습니다."
      : failure === "unavailable_temporarily"
        ? "잠시 후 다시 시도해 주세요."
        : "이미 삭제되었거나 접근할 수 없는 요청입니다.";

  return (
    <Alert
      tone="danger"
      title={
        <span className="sr-only" ref={titleRef} role="heading" tabIndex={-1}>
          {title}
        </span>
      }
    >
      <p aria-hidden="true" className="font-medium">
        {title}
      </p>
      <p>{description}</p>
      {failure === "unavailable_temporarily" ? (
        <Button className="mt-2" onClick={onRetry} type="button">
          다시 시도
        </Button>
      ) : null}
      <OwnListLink eventId={eventId} />
    </Alert>
  );
}
