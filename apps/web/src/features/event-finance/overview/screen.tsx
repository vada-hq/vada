import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Card } from "../../../components/ui/card";
import { StatusBadge } from "../../../components/ui/status-badge";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import { EmptyState, FailureState, LoadingState } from "../../../shared/screen/states";
import { DataTable } from "../../../shared/ui/data-table";
import { Page, PageHeader } from "../../../shared/ui/page";
import { formatAmount } from "../../purchase-request/shared/display";
import { boardColumns, budgetTone, itemsInColumn } from "./columns";
import {
  eventBudgetSummaryQueryOptions,
  eventItemBoardQueryOptions,
  type EventBoardItem,
  type EventBudgetSummary,
} from "./query";
import {
  financeQueue,
  requestRecords,
  stackByRequest,
  viewerIsFinance,
  type RequestRecord,
} from "./records";

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

/**
 * 계약은 보완 요청된 품목을 요청자에게 needs_attention, 다른 구성원에게
 * under_review로 합쳐 내려준다. 화면정의서는 다른 구성원에게 `보완 중`이라고
 * 적지만 계약이 그 둘을 구분하지 않으므로 화면이 알 방법이 없다. 지어내지 않고
 * 계약이 말하는 것만 적는다.
 */
const stateLabels: Record<EventBoardItem["progressState"], string> = {
  needs_attention: "보완 필요",
  under_review: "검토 중",
  rejected: "반려",
};

const stateTones: Record<EventBoardItem["progressState"], "warning" | "info" | "danger"> =
  {
    needs_attention: "warning",
    under_review: "info",
    rejected: "danger",
  };

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

function ItemCard({ eventId, item }: { eventId: string; item: EventBoardItem }) {
  return (
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
        <StatusBadge tone={stateTones[item.progressState]}>
          {stateLabels[item.progressState]}
        </StatusBadge>
        {item.requestedByViewer ? <StatusBadge tone="info">내 요청</StatusBadge> : null}
      </span>
    </Link>
  );
}

type OwnershipFilter = "all" | "mine";

function ItemBoard({ eventId, items }: { eventId: string; items: EventBoardItem[] }) {
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");
  const visible =
    ownership === "mine" ? items.filter((item) => item.requestedByViewer) : items;

  return (
    <div className="grid gap-snug">
      <fieldset className="flex flex-wrap items-center gap-tight">
        <legend className="sr-only">품목 범위</legend>
        {(
          [
            ["all", "전체 요청"],
            ["mine", "내 요청"],
          ] as const
        ).map(([value, label]) => (
          <label className="flex items-center gap-tight text-body" key={value}>
            <input
              checked={ownership === value}
              name="ownership"
              onChange={() => setOwnership(value)}
              type="radio"
              value={value}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <section aria-label="품목 현황" className="grid gap-snug lg:grid-cols-4">
        {boardColumns.map((column) => {
          const stacks = stackByRequest(itemsInColumn(visible, column));
          const count = stacks.reduce((sum, stack) => sum + stack.items.length, 0);

          return (
            <Card aria-label={`${column.label} 열`} key={column.label}>
              <h3 className="text-body font-medium">
                {column.label}
                {column.contracted ? (
                  <span className="ml-tight text-label text-muted-foreground">
                    {count}건
                  </span>
                ) : null}
              </h3>
              <p className="text-label text-muted-foreground">{column.description}</p>

              {!column.contracted ? (
                <p className="text-label text-muted-foreground" role="status">
                  아직 제공하지 않습니다.
                </p>
              ) : stacks.length === 0 ? (
                <p className="text-label text-muted-foreground" role="status">
                  해당 품목이 없습니다.
                </p>
              ) : (
                <ul className="grid gap-tight">
                  {stacks.map((stack) => (
                    <li key={stack.requestId}>
                      {/* 같은 요청의 카드가 2개 이상이면 스택으로 묶는다. */}
                      {stack.items.length > 1 ? (
                        <div className="grid gap-tight rounded-sm border border-dashed p-tight">
                          <p className="text-label text-muted-foreground">
                            {stack.requestId} · 품목 {stack.items.length}건
                          </p>
                          {stack.items.map((item) => (
                            <ItemCard eventId={eventId} item={item} key={item.itemId} />
                          ))}
                        </div>
                      ) : (
                        <ItemCard
                          eventId={eventId}
                          item={stack.items[0]}
                          key={stack.items[0].itemId}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </section>
    </div>
  );
}

/** 재정부 전용. 요청 검토 영역의 처리 대기 품목만 모은다. */
function FinanceQueue({ eventId, items }: { eventId: string; items: EventBoardItem[] }) {
  const queue = financeQueue(items);

  return (
    <section aria-label="처리 단계" className="grid gap-snug">
      <Card>
        <h3 className="text-body font-medium">
          요청 검토
          <span className="ml-tight text-label text-muted-foreground">
            {queue.length}건
          </span>
        </h3>
        <p className="text-label text-muted-foreground">처리 대기 품목</p>

        {queue.length === 0 ? (
          <p className="text-label text-muted-foreground" role="status">
            처리 대기 품목이 없습니다.
          </p>
        ) : (
          <ul className="grid gap-tight">
            {queue.map((item) => (
              <li key={item.itemId}>
                <Link
                  className="block rounded-sm border p-tight underline-offset-2 hover:underline focus-visible:outline-2"
                  params={{ eventId, requestId: item.requestId }}
                  to="/events/$eventId/purchase-requests/$requestId/review"
                >
                  <span className="block font-medium">{item.itemName}</span>
                  <span className="block text-label text-muted-foreground">
                    {item.requestDepartmentName} · {item.requesterName} ·{" "}
                    {formatAmount(item.estimatedTotalPrice)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {/* 나머지 6개 업무 영역은 채울 실행분이 구조적으로 존재할 수 없어 두지
          않는다. 열과 달리 탭은 없어도 이 화면의 성장 방향이 가려지지 않는다. */}
    </section>
  );
}

/** 재정부 전용. 요청 단위 표. 품목 목록에서 묶어 만든다. */
function RequestRecords({ eventId, items }: { eventId: string; items: EventBoardItem[] }) {
  const records = requestRecords(items);

  const columns = [
    {
      key: "requestId",
      header: "요청 번호",
      cell: (row: RequestRecord) => (
        <Link
          className="font-mono text-label underline-offset-2 hover:underline focus-visible:outline-2"
          params={{ eventId, requestId: row.requestId }}
          to="/events/$eventId/purchase-requests/$requestId"
        >
          {row.requestId}
        </Link>
      ),
    },
    {
      key: "requester",
      header: "요청자",
      cell: (row: RequestRecord) => `${row.requestDepartmentName} · ${row.requesterName}`,
    },
    {
      key: "itemCount",
      header: "품목",
      align: "end" as const,
      cell: (row: RequestRecord) => `${row.itemCount}건`,
    },
    {
      key: "estimatedTotal",
      header: "요청액",
      align: "end" as const,
      cell: (row: RequestRecord) => formatAmount(row.estimatedTotal),
    },
    {
      key: "needsAttention",
      header: "확인 필요",
      cell: (row: RequestRecord) =>
        row.needsAttention > 0 ? (
          <StatusBadge tone="warning">{row.needsAttention}건</StatusBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <section aria-label="기록 · 구매 요청">
      <DataTable
        columns={columns}
        label="구매 요청 기록"
        rowKey={(row) => row.requestId}
        rows={records}
      />
    </section>
  );
}

/** 재정부에게만 보이는 묶음. 기본은 처리 단계다. */
const financeViews = [
  { group: "작업 보드", key: "stage", label: "처리 단계" },
  { group: "작업 보드", key: "board", label: "품목 현황" },
  { group: "기록", key: "records", label: "구매 요청" },
] as const;

type ViewKey = (typeof financeViews)[number]["key"];

function ViewTabs({
  onSelect,
  selected,
}: {
  onSelect: (key: ViewKey) => void;
  selected: ViewKey;
}) {
  const groups = ["작업 보드", "기록"] as const;

  return (
    <nav aria-label="재정 하위 메뉴" className="flex flex-wrap items-center gap-base">
      {groups.map((group) => (
        <div className="flex items-center gap-tight" key={group}>
          <span className="text-label text-muted-foreground">{group}</span>
          <div className="flex gap-tight" role="tablist" aria-label={group}>
            {financeViews
              .filter((view) => view.group === group)
              .map((view) => (
                <button
                  aria-selected={selected === view.key}
                  className={[
                    "rounded-sm px-snug py-tight text-body",
                    selected === view.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground",
                  ].join(" ")}
                  key={view.key}
                  onClick={() => onSelect(view.key)}
                  role="tab"
                  type="button"
                >
                  {view.label}
                </button>
              ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function EventFinanceOverviewScreen({ eventId }: { eventId: string }) {
  const budget = useQuery(eventBudgetSummaryQueryOptions(eventId));
  const board = useQuery(eventItemBoardQueryOptions(eventId));
  const [view, setView] = useState<ViewKey>("stage");

  const failure = budget.error ?? board.error;
  const items = board.data?.items ?? [];
  const isFinance = viewerIsFinance(items);

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
        items.length === 0 ? (
          <EmptyState>이 행사에는 아직 구매 요청이 없습니다.</EmptyState>
        ) : !isFinance ? (
          // 일반 구성원·부서장에게는 품목 현황만 보인다. 처리 단계와 기록은
          // 재정부의 업무 화면이라 노출하지 않는다.
          <ItemBoard eventId={eventId} items={items} />
        ) : (
          <div className="grid gap-snug">
            <ViewTabs onSelect={setView} selected={view} />
            <div role="tabpanel">
              {view === "stage" ? <FinanceQueue eventId={eventId} items={items} /> : null}
              {view === "board" ? <ItemBoard eventId={eventId} items={items} /> : null}
              {view === "records" ? (
                <RequestRecords eventId={eventId} items={items} />
              ) : null}
            </div>
          </div>
        )
      ) : null}
    </Page>
  );
}
