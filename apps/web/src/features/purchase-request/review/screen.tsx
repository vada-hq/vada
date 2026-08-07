import { useQuery } from "@tanstack/react-query";
import type { PurchaseRequestDetailView } from "@vada/api-client";

import { Alert } from "../../../components/ui/alert";
import { Card } from "../../../components/ui/card";
import { StatusBadge } from "../../../components/ui/status-badge";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import { FailureState, LoadingState } from "../../../shared/screen/states";
import { DataTable } from "../../../shared/ui/data-table";
import { Page, PageHeader, SectionHeading } from "../../../shared/ui/page";
import { formatAmount, formatCreatedDate } from "../shared/display";
import { OwnListLink } from "../shared/navigation";
import { DecisionActions, useDecisions } from "./decisions";
import {
  reviewQueryOptions,
  type ItemReviewState,
  type ItemReviewStatus,
  type PurchaseRequestReviewView,
} from "./query";

type DetailItem =
  PurchaseRequestDetailView["record"]["content"]["items"][number];
type ReviewRow = DetailItem & { itemId: string };

const statusLabels: Record<ItemReviewStatus, string> = {
  review_pending: "검토 대기",
  approved: "승인",
  revision_requested: "보완 요청",
  rejected: "반려",
};

const statusTones: Record<ItemReviewStatus, "info" | "warning" | "danger"> = {
  review_pending: "info",
  approved: "info",
  revision_requested: "warning",
  rejected: "danger",
};

function describeFailure(failure: ApiFailure) {
  if (failure === "unauthenticated") {
    return {
      title: "다시 인증해야 합니다.",
      description: "세션이 만료되어 검토 화면을 열 수 없습니다.",
    };
  }
  if (failure === "forbidden") {
    return {
      title: "검토 권한이 없습니다.",
      description: "구매 요청 검토는 재정부만 할 수 있습니다.",
    };
  }
  if (failure === "unavailable_temporarily") {
    return {
      title: "검토 화면을 일시적으로 불러오지 못했습니다.",
      description: "잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    title: "요청을 찾을 수 없습니다.",
    description: "이미 처리되었거나 접근할 수 없는 요청입니다.",
  };
}

export function PurchaseRequestReviewScreen({
  eventId,
  requestId,
}: {
  eventId: string;
  requestId: string;
}) {
  const query = useQuery(reviewQueryOptions(eventId, requestId));

  if (query.isPending) {
    return (
      <Page>
        <LoadingState label="검토 화면을 불러오는 중입니다." />
      </Page>
    );
  }

  if (query.isError) {
    return (
      <Page>
        <FailureState
          actions={<OwnListLink eventId={eventId} />}
          describe={describeFailure}
          failure={failureOf(query.error)}
          onRetry={() => void query.refetch()}
        />
      </Page>
    );
  }

  return <ReviewBody eventId={eventId} requestId={requestId} view={query.data} />;
}

function ReviewBody({
  eventId,
  requestId,
  view,
}: {
  eventId: string;
  requestId: string;
  view: PurchaseRequestReviewView;
}) {
  const { record, display } = view.detail;
  const decisions = useDecisions(eventId, requestId);
  const states = new Map(
    view.itemReviewStates.map((state) => [state.itemId, state]),
  );
  // 품목 입력에는 식별자가 없고 itemResults에만 있다. 계약이 둘의 순서를 같게
  // 유지하므로 자리로 이어 붙인다. 화면이 식별자를 지어내지 않는다.
  const rows = record.content.items.map((item, index) => ({
    ...item,
    itemId: record.itemResults[index]?.itemId ?? `item-${index}`,
  }));

  return (
    <Page>
      <PageHeader
        description={`${display.requesterName} · 제출 ${formatCreatedDate(record.createdAt)}`}
        title={record.content.title}
      />

      <Card className="flex flex-wrap items-center gap-loose">
        <Figure label="전체 요청액" value={formatAmount(record.estimatedTotal)} />
        <Figure label="품목 수" value={`${record.content.items.length}개`} />
        <Figure label="필요한 날짜" value={record.content.neededDate} />
      </Card>

      {decisions.failure ? (
        <Alert tone="danger" title="처리하지 못했습니다.">
          <p>{decisions.failure}</p>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-base">
        <SectionHeading>품목 검토</SectionHeading>
        <DataTable
          columns={[
            {
              key: "name",
              header: "품목명",
              cell: (item: ReviewRow) => item.name,
            },
            {
              key: "quantity",
              header: "수량",
              cell: (item: ReviewRow) => `${item.quantity}${item.unit}`,
            },
            {
              key: "amount",
              header: "요청액",
              align: "end" as const,
              cell: (item: ReviewRow) =>
                formatAmount(item.quantity * item.estimatedUnitPrice),
            },
            {
              key: "evidence",
              header: "가격 근거",
              cell: (item: ReviewRow) => (
                <span className="text-body text-muted-foreground">
                  {item.priceEvidence.length
                    ? `${item.priceEvidence.length}건`
                    : "없음"}
                </span>
              ),
            },
            {
              key: "status",
              header: "현재 상태",
              cell: (item: ReviewRow) => (
                <ItemStatus state={states.get(item.itemId)} />
              ),
            },
            {
              key: "decision",
              header: "결정",
              cell: (item: ReviewRow) => {
                const state = states.get(item.itemId);
                // 확정된 품목에는 결정 행동을 그리지 않는다. 이미 처리된 것을
                // 덮어쓰지 않는다는 규칙이 화면에도 그대로 보인다.
                if (state?.reviewStatus !== "review_pending") {
                  return <span className="text-muted-foreground">—</span>;
                }
                return (
                  <DecisionActions
                    busy={decisions.busy}
                    onDecide={decisions.decide(
                      item.itemId,
                      item.name,
                      state.reviewStatus,
                    )}
                  />
                );
              },
            },
          ]}
          label="품목 검토"
          rowKey={(item) => item.itemId}
          rows={rows}
        />
      </section>

      <section className="flex flex-col gap-base">
        <SectionHeading>처리 기록</SectionHeading>
        <ol aria-label="처리 기록" className="flex flex-col gap-snug">
          {view.history.map((entry) => (
            <li
              className="flex flex-wrap items-baseline gap-snug border-b border-border pb-snug text-body"
              key={`${entry.recordedAt}-${entry.summary}`}
            >
              <span className="text-label text-muted-foreground tabular-nums">
                {formatCreatedDate(entry.recordedAt)}
              </span>
              <span className="font-medium">{entry.actorName}</span>
              <span className="text-muted-foreground">{entry.summary}</span>
            </li>
          ))}
        </ol>
      </section>

      {decisions.dialog}
    </Page>
  );
}

function ItemStatus({ state }: { state: ItemReviewState | undefined }) {
  if (!state) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-tight">
      <StatusBadge tone={statusTones[state.reviewStatus]}>
        {statusLabels[state.reviewStatus]}
      </StatusBadge>
      {state.revisionDueDate ? (
        <span className="text-label text-muted-foreground">
          {state.revisionDueDate}까지
        </span>
      ) : null}
    </span>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-tight">
      <span className="text-label text-muted-foreground">{label}</span>
      <span className="text-body-lg font-semibold tabular-nums">{value}</span>
    </span>
  );
}
