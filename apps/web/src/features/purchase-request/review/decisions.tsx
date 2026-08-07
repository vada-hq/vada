import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { failureOf } from "../../../shared/api/failure";
import {
  decideItem,
  reviewQueryKey,
  type ItemReviewStatus,
  type PurchaseRequestReviewView,
  type ReviewDecision,
} from "./query";

const dialogTitles: Record<"request_revision" | "reject", string> = {
  request_revision: "보완 요청",
  reject: "반려",
};

interface Pending {
  itemId: string;
  itemName: string;
  expectedReviewStatus: ItemReviewStatus;
  kind: "request_revision" | "reject";
}

export interface DecisionControls {
  /** 결정 행동을 그릴 수 있는 품목인지. 확정된 품목에는 그리지 않는다. */
  decide: (
    itemId: string,
    itemName: string,
    status: ItemReviewStatus,
  ) => (kind: ReviewDecision) => void;
  busy: boolean;
  failure: string | null;
  dialog: React.ReactNode;
}

/**
 * 품목 결정을 서버에 보내고 화면을 갱신한다.
 *
 * 승인은 곧바로 보내고, 보완 요청과 반려는 사유가 필요해 팝업을 연다.
 * 계약이 결정마다 필요한 값을 다르게 정하므로 화면도 그대로 나눈다.
 */
export function useDecisions(
  eventId: string,
  requestId: string,
): DecisionControls {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");

  const apply = async (
    itemId: string,
    expectedReviewStatus: ItemReviewStatus,
    decision: ReviewDecision,
    extra: { revisionReason?: string; revisionDueDate?: string; rejectionReason?: string },
  ) => {
    setBusy(true);
    setFailure(null);
    try {
      const next = await decideItem(eventId, requestId, itemId, {
        decision,
        expectedReviewStatus,
        ...extra,
      });
      queryClient.setQueryData<PurchaseRequestReviewView>(
        reviewQueryKey(eventId, requestId),
        next,
      );
      setPending(null);
      setReason("");
      setDueDate("");
    } catch (error) {
      const kind = failureOf(error);
      if (kind === "conflict") {
        // 다른 재정부원이 먼저 처리했다. 덮어쓰지 않고 현재 상태를 다시 읽는다.
        setFailure("다른 사람이 먼저 처리했습니다. 최신 상태를 불러왔습니다.");
        await queryClient.invalidateQueries({
          queryKey: reviewQueryKey(eventId, requestId),
        });
        setPending(null);
      } else if (kind === "validation_failed") {
        setFailure("결정에 필요한 값을 확인해 주세요.");
      } else if (kind === "forbidden") {
        setFailure("검토 권한이 없습니다.");
      } else {
        setFailure("처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  };

  const decide =
    (itemId: string, itemName: string, status: ItemReviewStatus) =>
    (kind: ReviewDecision) => {
      setFailure(null);
      if (kind === "approve") {
        void apply(itemId, status, "approve", {});
        return;
      }
      setReason("");
      setDueDate("");
      setPending({ itemId, itemName, expectedReviewStatus: status, kind });
    };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 한국어 IME 조합 중 Enter는 제출로 처리하지 않는다.
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) {
      return;
    }
    if (!pending) return;
    void apply(
      pending.itemId,
      pending.expectedReviewStatus,
      pending.kind,
      pending.kind === "request_revision"
        ? { revisionReason: reason, revisionDueDate: dueDate }
        : { rejectionReason: reason },
    );
  };

  const dialog = pending ? (
    <Dialog
      description={pending.itemName}
      onClose={() => setPending(null)}
      open
      title={dialogTitles[pending.kind]}
    >
      <form className="flex flex-col gap-base p-loose" noValidate onSubmit={submit}>
        {failure ? (
          <Alert tone="danger" title="처리하지 못했습니다.">
            <p>{failure}</p>
          </Alert>
        ) : null}

        <FormField id="decision-reason" label="사유" required>
          <Input
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </FormField>

        {pending.kind === "request_revision" ? (
          <FormField id="decision-due-date" label="재제출 기한" required>
            <Input
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </FormField>
        ) : null}

        <span className="flex gap-snug">
          <Button disabled={busy} type="submit">
            {dialogTitles[pending.kind]}
          </Button>
          <Button onClick={() => setPending(null)} type="button" variant="secondary">
            취소
          </Button>
        </span>
      </form>
    </Dialog>
  ) : null;

  return { decide, busy, failure: pending ? null : failure, dialog };
}

export function DecisionActions({
  busy,
  onDecide,
}: {
  busy: boolean;
  onDecide: (kind: ReviewDecision) => void;
}) {
  return (
    <span className="flex flex-wrap gap-tight">
      <Button disabled={busy} onClick={() => onDecide("approve")} type="button">
        승인
      </Button>
      <Button
        disabled={busy}
        onClick={() => onDecide("request_revision")}
        type="button"
        variant="secondary"
      >
        보완 요청
      </Button>
      <Button
        disabled={busy}
        onClick={() => onDecide("reject")}
        type="button"
        variant="secondary"
      >
        반려
      </Button>
    </span>
  );
}
