import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Card } from "../../../components/ui/card";
import { StatusBadge } from "../../../components/ui/status-badge";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import { EmptyState, FailureState, LoadingState } from "../../../shared/screen/states";
import { Page, PageHeader } from "../../../shared/ui/page";
import { formatAmount } from "../../purchase-request/shared/display";
import { boardColumns, budgetTone, itemsInColumn } from "./columns";
import {
  eventBudgetSummaryQueryOptions,
  eventItemBoardQueryOptions,
  type EventBoardItem,
  type EventBudgetSummary,
} from "./query";

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
  // 권한 없음과 찾을 수 없음은 다른 조직 데이터의 존재를 노출하지 않는다.
  return {
    title: "행사 재정을 볼 수 없습니다.",
    description: "이 행사의 재정 현황에 접근할 수 없습니다.",
  };
}

const stateLabels: Record<EventBoardItem["progressState"], string> = {
  needs_attention: "보완 필요",
  under_review: "검토 중",
  rejected: "반려",
};

/** 보완 상태는 보는 사람에 따라 다르게 말한다. 화면정의서가 정한 예외다. */
function stateLabel(item: EventBoardItem) {
  if (item.progressState === "under_review" && !item.requestedByViewer) {
    return "검토 중";
  }
  return stateLabels[item.progressState];
}

function BudgetSummaryCards({ summary }: { summary: EventBudgetSummary }) {
  const tone = budgetTone(summary);

  return (
    <section aria-label="예산 요약" className="grid gap-snug sm:grid-cols-4">
      <SummaryCard label="배정 예산" value={formatAmount(summary.allocatedTotal)} />
      <SummaryCard label="승인 예약" value={formatAmount(summary.committedTotal)} />
      <SummaryCard
        emphasis
        label="사용 가능"
        note={
          tone === "unallocated"
            ? "예산이 배정되지 않았습니다."
            : tone === "over"
              ? "예산을 초과했습니다."
              : undefined
        }
        tone={tone === "over" ? "danger" : undefined}
        value={formatAmount(summary.availableTotal)}
      />
      {/* 실제 지출은 증빙 완료로만 확정된다. 그 흐름이 없어 0원으로 채우지
          않는다. 0원이 "지출 없음"인지 "집계 없음"인지 구분되지 않는다. */}
      <SummaryCard label="실제 지출" note="아직 제공하지 않습니다." value="—" />
    </section>
  );
}

function SummaryCard({
  emphasis,
  label,
  note,
  tone,
  value,
}: {
  emphasis?: boolean;
  label: string;
  note?: string;
  tone?: "danger";
  value: string;
}) {
  return (
    <Card>
      <p className="text-label text-muted-foreground">{label}</p>
      <p
        className={[
          "text-heading",
          emphasis ? "font-semibold" : "",
          tone === "danger" ? "text-destructive" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
      {note ? <p className="text-label text-muted-foreground">{note}</p> : null}
    </Card>
  );
}

function ItemBoard({ eventId, items }: { eventId: string; items: EventBoardItem[] }) {
  return (
    <section aria-label="품목 현황" className="grid gap-snug lg:grid-cols-4">
      {boardColumns.map((column) => {
        const columnItems = itemsInColumn(items, column);
        return (
          <Card aria-label={`${column.label} 열`} key={column.label}>
            <h3 className="text-body font-medium">
              {column.label}
              {column.contracted ? (
                <span className="ml-tight text-label text-muted-foreground">
                  {columnItems.length}건
                </span>
              ) : null}
            </h3>
            <p className="text-label text-muted-foreground">{column.description}</p>

            {!column.contracted ? (
              <p className="text-label text-muted-foreground" role="status">
                아직 제공하지 않습니다.
              </p>
            ) : columnItems.length === 0 ? (
              <p className="text-label text-muted-foreground" role="status">
                해당 품목이 없습니다.
              </p>
            ) : (
              <ul className="grid gap-tight">
                {columnItems.map((item) => (
                  <li key={item.itemId}>
                    <Link
                      className="block rounded-sm border p-tight underline-offset-2 hover:underline focus-visible:outline-2"
                      params={{ eventId, requestId: item.requestId }}
                      to="/events/$eventId/purchase-requests/$requestId"
                    >
                      <span className="block font-medium">{item.itemName}</span>
                      <span className="block text-label text-muted-foreground">
                        {item.requestDepartmentName} · {item.requesterName} ·{" "}
                        {formatAmount(item.estimatedTotalPrice)}
                      </span>
                      <span className="mt-tight flex flex-wrap items-center gap-tight">
                        <StatusBadge
                          tone={
                            item.progressState === "needs_attention"
                              ? "warning"
                              : item.progressState === "rejected"
                                ? "danger"
                                : "info"
                          }
                        >
                          {stateLabel(item)}
                        </StatusBadge>
                        {item.requestedByViewer ? (
                          <StatusBadge tone="info">내 요청</StatusBadge>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </section>
  );
}

export function EventFinanceOverviewScreen({ eventId }: { eventId: string }) {
  const budget = useQuery(eventBudgetSummaryQueryOptions(eventId));
  const board = useQuery(eventItemBoardQueryOptions(eventId));

  const failure = budget.error ?? board.error;

  return (
    <Page>
      <PageHeader
        actions={
          <span className="flex flex-wrap items-center gap-snug">
            <Link
              className="text-body underline-offset-2 hover:underline focus-visible:outline-2"
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
        description="이 행사의 예산과 구매 품목 현황"
        title="행사 재정"
      />

      {budget.isPending || board.isPending ? (
        <LoadingState label="행사 재정을 불러오는 중입니다." />
      ) : null}

      {failure ? (
        <FailureState
          describe={describeFailure}
          failure={failureOf(failure)}
          onRetry={() => {
            void budget.refetch();
            void board.refetch();
          }}
        />
      ) : null}

      {budget.isSuccess && !failure ? (
        <BudgetSummaryCards summary={budget.data} />
      ) : null}

      {board.isSuccess && !failure ? (
        board.data.items.length === 0 ? (
          <EmptyState>이 행사에는 아직 구매 요청이 없습니다.</EmptyState>
        ) : (
          <ItemBoard eventId={eventId} items={board.data.items} />
        )
      ) : null}
    </Page>
  );
}
