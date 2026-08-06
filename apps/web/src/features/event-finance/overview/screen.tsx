import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Card } from "../../../components/ui/card";
import { StatusBadge } from "../../../components/ui/status-badge";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import { FailureState, LoadingState } from "../../../shared/screen/states";
import { DataTable } from "../../../shared/ui/data-table";
import { Page, PageHeader } from "../../../shared/ui/page";
import { formatAmount, formatCreatedDate } from "../../purchase-request/shared/display";
import type {
  BudgetSummary,
  EventListItem,
} from "../../../mocks/event-finance-fixtures";
import { budgetSummaryQueryOptions, eventRequestListQueryOptions } from "./query";
import {
  formatRequestStatus,
  itemsInStage,
  reviewPendingCount,
  stages,
} from "./stages";

function describeFailure(failure: ApiFailure) {
  if (failure === "unauthenticated") {
    return {
      title: "다시 인증해야 합니다.",
      description: "세션이 만료되어 행사 재정을 표시할 수 없습니다.",
    };
  }
  if (failure === "unavailable_temporarily") {
    return {
      title: "행사 재정을 일시적으로 불러오지 못했습니다.",
      description: "잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    title: "행사 재정을 볼 수 없습니다.",
    description: "이 행사의 재정 현황에 접근할 수 없습니다.",
  };
}

export function EventFinanceOverviewScreen({ eventId }: { eventId: string }) {
  const budget = useQuery(budgetSummaryQueryOptions(eventId));
  const list = useQuery(eventRequestListQueryOptions(eventId));
  const [view, setView] = useState<"list" | "stage">("list");

  if (budget.isPending || list.isPending) {
    return (
      <Page>
        <LoadingState label="행사 재정을 불러오는 중입니다." />
      </Page>
    );
  }

  if (budget.isError || list.isError) {
    return (
      <Page>
        <FailureState
          describe={describeFailure}
          failure={failureOf(budget.error ?? list.error)}
          onRetry={() => {
            void budget.refetch();
            void list.refetch();
          }}
        />
      </Page>
    );
  }

  const items = list.data.items;

  return (
    <Page>
      <PageHeader
        actions={
          <span className="flex flex-wrap items-center gap-snug">
            <Link
              className="rounded-sm border border-border px-snug py-tight text-body"
              params={{ eventId }}
              to="/events/$eventId/purchase-requests/mine"
            >
              내 구매 요청
            </Link>
            <Link
              className="rounded-sm bg-primary px-snug py-tight text-body text-primary-foreground"
              params={{ eventId }}
              to="/events/$eventId/purchase-requests/new"
            >
              새 구매 요청
            </Link>
          </span>
        }
        description="이 행사의 예산 현황과 구매 요청 처리 상태"
        title="행사 재정"
      />

      <BudgetSummarySection summary={budget.data} />

      <div className="flex flex-wrap items-center justify-between gap-snug border-b border-border">
        <div className="flex gap-base" role="tablist">
          {(["stage", "list"] as const).map((value) => (
            <button
              aria-selected={view === value}
              className={
                view === value
                  ? "-mb-px border-b-2 border-primary px-tight py-snug text-body-lg font-medium text-primary-soft-foreground"
                  : "-mb-px border-b-2 border-transparent px-tight py-snug text-body-lg text-muted-foreground"
              }
              key={value}
              onClick={() => setView(value)}
              role="tab"
              type="button"
            >
              {value === "stage" ? "처리 단계" : "전체 목록"}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-tight pb-snug">
          <span className="text-body text-muted-foreground">검토 대기</span>
          <span
            aria-label="검토 대기 건수"
            className="rounded-sm bg-primary px-snug text-label font-bold text-primary-foreground"
          >
            {reviewPendingCount(items)}
          </span>
        </span>
      </div>

      {view === "list" ? (
        <RequestListView eventId={eventId} items={items} />
      ) : (
        <StageBoard eventId={eventId} items={items} />
      )}
    </Page>
  );
}

function BudgetSummarySection({ summary }: { summary: BudgetSummary }) {
  const overspent = summary.availableTotal < 0;

  const cards = [
    { label: "배정 예산", value: summary.allocatedTotal, emphasis: false },
    { label: "승인·집행 예정액", value: summary.committedTotal, emphasis: false },
    { label: "사용 가능액", value: summary.availableTotal, emphasis: true },
  ];

  return (
    <section aria-label="예산 요약" className="flex flex-col gap-base">
      <div className="grid gap-base sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <p className="text-label text-muted-foreground">{card.label}</p>
            <p
              className={
                card.emphasis
                  ? "text-title font-bold tabular-nums text-primary"
                  : "text-title font-bold tabular-nums"
              }
            >
              {formatAmount(card.value)}
            </p>
            {card.emphasis && overspent ? (
              <StatusBadge tone="warning">예산 초과</StatusBadge>
            ) : null}
          </Card>
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: "budgetItem",
            header: "예산 항목",
            cell: (row) => row.budgetItem,
          },
          {
            key: "allocated",
            header: "배정",
            align: "end" as const,
            cell: (row) => formatAmount(row.allocatedAmount),
          },
          {
            key: "committed",
            header: "집행 예정",
            align: "end" as const,
            cell: (row) => formatAmount(row.committedAmount),
          },
          {
            key: "available",
            header: "사용 가능",
            align: "end" as const,
            cell: (row) => formatAmount(row.availableAmount),
          },
        ]}
        label="예산 항목별 배정"
        rowKey={(row) => row.budgetItem}
        rows={summary.allocations}
      />
    </section>
  );
}

function RequestTitleLink({
  eventId,
  item,
}: {
  eventId: string;
  item: EventListItem;
}) {
  return (
    <span className="flex items-center gap-tight">
      <Link
        className="font-medium underline-offset-2 hover:underline"
        params={{ eventId, requestId: item.requestId }}
        to="/events/$eventId/purchase-requests/$requestId"
      >
        {item.title}
      </Link>
      {item.priority === "urgent" ? (
        <StatusBadge tone="danger">긴급</StatusBadge>
      ) : null}
    </span>
  );
}

function RequestListView({
  eventId,
  items,
}: {
  eventId: string;
  items: EventListItem[];
}) {
  if (!items.length) {
    return (
      <Card>
        <p role="status">이 행사에 제출된 구매 요청이 없습니다.</p>
      </Card>
    );
  }

  return (
    <DataTable
      columns={[
        {
          key: "createdAt",
          header: "요청일",
          cell: (row: EventListItem) => (
            <span className="text-muted-foreground">
              {formatCreatedDate(row.createdAt)}
            </span>
          ),
        },
        {
          key: "title",
          header: "구매 요청명",
          cell: (row: EventListItem) => (
            <RequestTitleLink eventId={eventId} item={row} />
          ),
        },
        {
          key: "department",
          header: "요청 부서",
          cell: (row: EventListItem) => row.requestDepartmentName,
        },
        {
          key: "total",
          header: "전체 요청액",
          align: "end" as const,
          cell: (row: EventListItem) => formatAmount(row.estimatedTotal),
        },
        {
          key: "status",
          header: "현재 상태",
          cell: (row: EventListItem) => (
            <span className="flex flex-wrap items-center gap-tight">
              <StatusBadge tone="info">
                {formatRequestStatus(row.status)}
              </StatusBadge>
              {row.overBudget ? (
                <StatusBadge tone="warning">예산 초과</StatusBadge>
              ) : null}
            </span>
          ),
        },
      ]}
      label="행사 구매 요청"
      rowKey={(row) => row.requestId}
      rows={items}
    />
  );
}

function StageBoard({
  eventId,
  items,
}: {
  eventId: string;
  items: EventListItem[];
}) {
  return (
    <div className="flex gap-base overflow-x-auto pb-base">
      {stages.map((stage) => {
        const staged = itemsInStage(items, stage);

        return (
          <section
            aria-label={stage.label}
            className="flex min-w-64 flex-1 flex-col gap-snug"
            key={stage.label}
          >
            <p className="text-body font-semibold">{stage.label}</p>
            <div className="flex min-h-48 flex-col gap-snug rounded-md border border-dashed border-border bg-muted/50 p-snug">
              {staged.map((item) => (
                <Card className="flex flex-col gap-tight" key={item.requestId}>
                  <span className="flex items-center justify-between gap-snug">
                    <StatusBadge tone="neutral">
                      {item.requestDepartmentName}
                    </StatusBadge>
                    <span className="text-caption text-muted-foreground">
                      {formatCreatedDate(item.createdAt)}
                    </span>
                  </span>
                  <RequestTitleLink eventId={eventId} item={item} />
                  <span className="flex items-center justify-between gap-snug border-t border-border pt-tight">
                    <span className="text-body font-semibold tabular-nums">
                      {formatAmount(item.estimatedTotal)}
                    </span>
                    <StatusBadge tone="info">
                      {formatRequestStatus(item.status)}
                    </StatusBadge>
                  </span>
                </Card>
              ))}

              {staged.length === 0 ? (
                <p className="py-loose text-center text-label text-muted-foreground">
                  {stage.contracted
                    ? "항목 없음"
                    : "아직 처리 단계가 없습니다."}
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
