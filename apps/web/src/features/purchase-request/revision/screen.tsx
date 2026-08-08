import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";

import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { StatusBadge } from "../../../components/ui/status-badge";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import { EmptyState, FailureState, LoadingState } from "../../../shared/screen/states";
import { Page, PageHeader } from "../../../shared/ui/page";
import { formatAmount } from "../shared/display";
import {
  revisionQueryKey,
  revisionQueryOptions,
  submitRevision,
  type RevisionItem,
  type RevisionItemContent,
} from "./query";

function describeFailure(failure: ApiFailure) {
  if (failure === "unauthenticated") {
    return {
      title: "다시 인증해야 합니다.",
      description: "세션이 만료되어 보완 요청을 표시할 수 없습니다.",
    };
  }
  if (failure === "conflict") {
    return {
      title: "그 사이 검토가 진행됐습니다.",
      description: "재정부가 이미 재검토를 끝냈습니다. 최신 상태를 다시 읽어 주세요.",
    };
  }
  if (failure === "unavailable_temporarily") {
    return {
      title: "보완 요청을 일시적으로 불러오지 못했습니다.",
      description: "잠시 후 다시 시도해 주세요.",
    };
  }
  // 권한 없음과 찾을 수 없음은 다른 조직 데이터의 존재를 노출하지 않는다.
  return {
    title: "이 요청을 다시 낼 수 없습니다.",
    description: "보완을 요청받은 본인의 구매 요청만 다시 낼 수 있습니다.",
  };
}

const statusLabels: Record<string, string> = {
  review_pending: "검토 대기",
  approved: "승인",
  rejected: "반려",
};

function isComplete(content: RevisionItemContent) {
  return (
    Boolean(content.name?.trim()) &&
    typeof content.quantity === "number" &&
    content.quantity > 0 &&
    typeof content.estimatedUnitPrice === "number" &&
    content.estimatedUnitPrice > 0
  );
}

function RevisionItemForm({
  content,
  item,
  onChange,
}: {
  content: RevisionItemContent;
  item: RevisionItem;
  onChange: (patch: RevisionItemContent) => void;
}) {
  return (
    <Card aria-label={`${item.itemName} 보완`}>
      {/* 사유와 기한은 품목마다 다르다. 그래서 품목 옆에 붙인다. */}
      <Alert tone="warning" title="보완 요청">
        <p>{item.revisionReason}</p>
        {item.revisionDueDate ? (
          <p className="text-label text-muted-foreground">
            재제출 기한 {item.revisionDueDate} — 지나도 다시 낼 수 있습니다.
          </p>
        ) : null}
      </Alert>

      <div className="mt-snug grid gap-loose sm:grid-cols-3">
        <FormField id={`${item.itemId}-name`} label="품목명" required>
          <Input
            onChange={(event) => onChange({ name: event.target.value })}
            value={content.name ?? ""}
          />
        </FormField>
        <FormField id={`${item.itemId}-quantity`} label="수량" required>
          <Input
            min={1}
            onChange={(event) => onChange({ quantity: Number(event.target.value) })}
            type="number"
            value={content.quantity ?? ""}
          />
        </FormField>
        <FormField id={`${item.itemId}-price`} label="예상 단가" required>
          <Input
            min={1}
            onChange={(event) =>
              onChange({ estimatedUnitPrice: Number(event.target.value) })
            }
            type="number"
            value={content.estimatedUnitPrice ?? ""}
          />
        </FormField>
      </div>

      <FormField
        description="파일 첨부는 아직 제공하지 않습니다. 업체와 금액을 글로 남겨 주세요."
        id={`${item.itemId}-note`}
        label="가격 근거"
      >
        <Input
          onChange={(event) => onChange({ requestNote: event.target.value })}
          value={content.requestNote ?? ""}
        />
      </FormField>
    </Card>
  );
}

export function PurchaseRequestRevisionScreen({
  eventId,
  requestId,
}: {
  eventId: string;
  requestId: string;
}) {
  const query = useQuery(revisionQueryOptions(eventId, requestId));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [edits, setEdits] = useState<Record<string, RevisionItemContent>>({});
  // 같은 재제출의 재시도는 같은 키를 쓴다. 실패해도 새로 만들지 않는다.
  const idempotencyKey = useRef(crypto.randomUUID());

  const items = query.data?.revisionItems ?? [];
  const contentOf = (item: RevisionItem) => edits[item.itemId] ?? item.content;
  const ready = items.length > 0 && items.every((item) => isComplete(contentOf(item)));

  const mutation = useMutation({
    mutationFn: () =>
      submitRevision(
        eventId,
        requestId,
        items.map((item) => ({ itemId: item.itemId, content: contentOf(item) })),
        idempotencyKey.current,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: revisionQueryKey(eventId, requestId),
      });
      void navigate({
        params: { eventId, requestId },
        to: "/events/$eventId/purchase-requests/$requestId",
      });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 한국어 IME의 Enter 이중 입력을 막는다.
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    if (!ready || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <Page>
      <PageHeader
        description="재정부가 보완을 요청한 품목만 고쳐 다시 냅니다"
        title="보완 요청 확인·재제출"
      />

      {query.isPending ? (
        <LoadingState label="보완 요청을 불러오는 중입니다." />
      ) : null}

      {query.isError ? (
        <FailureState
          describe={describeFailure}
          failure={failureOf(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.isSuccess && items.length === 0 ? (
        <EmptyState>이 요청에는 보완을 요청받은 품목이 없습니다.</EmptyState>
      ) : null}

      {query.isSuccess && items.length > 0 ? (
        <form className="grid gap-loose" onSubmit={handleSubmit}>
          {mutation.isError ? (
            <FailureState
              describe={describeFailure}
              failure={failureOf(mutation.error)}
              onRetry={() => void query.refetch()}
            />
          ) : null}

          {items.map((item) => (
            <RevisionItemForm
              content={contentOf(item)}
              item={item}
              key={item.itemId}
              onChange={(patch) =>
                setEdits((current) => ({
                  ...current,
                  [item.itemId]: { ...contentOf(item), ...patch },
                }))
              }
            />
          ))}

          {query.data.otherItems.length > 0 ? (
            <Card aria-label="나머지 품목">
              <h3 className="text-body font-medium">나머지 품목</h3>
              <p className="text-label text-muted-foreground">
                요청 전체의 맥락입니다. 여기서는 고칠 수 없습니다.
              </p>
              <ul className="mt-snug grid gap-tight">
                {query.data.otherItems.map((item) => (
                  <li className="flex flex-wrap items-center gap-snug" key={item.itemId}>
                    <span className="font-medium">{item.itemName}</span>
                    <span className="text-muted-foreground">
                      {formatAmount(item.estimatedTotalPrice)}
                    </span>
                    <StatusBadge
                      tone={item.reviewStatus === "rejected" ? "danger" : "info"}
                    >
                      {statusLabels[item.reviewStatus] ?? item.reviewStatus}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="flex items-center gap-snug">
            <Button disabled={!ready || mutation.isPending} type="submit">
              {mutation.isPending ? "제출하는 중…" : "재제출"}
            </Button>
            {!ready ? (
              <p className="text-label text-muted-foreground" role="status">
                보완 품목의 필수 입력을 모두 채워 주세요.
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </Page>
  );
}
