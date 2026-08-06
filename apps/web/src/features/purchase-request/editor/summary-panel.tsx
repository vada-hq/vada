import { Link } from "@tanstack/react-router";

import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { formatAmount } from "../shared/display";

const priorityLabels: Record<string, string> = {
  normal: "보통",
  urgent: "긴급",
};

/** 와이어프레임 오른쪽 고정 요약 패널이다. */
export function EditorSummaryPanel({
  busy,
  eventId,
  itemCount,
  neededDate,
  onSaveDraft,
  onSubmit,
  notice,
  priority,
  total,
}: {
  busy: "idle" | "saving" | "submitting";
  eventId: string;
  itemCount: number;
  neededDate: string;
  onSaveDraft: () => void;
  onSubmit: () => void;
  notice: string | null;
  priority: string;
  total: number;
}) {
  return (
    <aside
      aria-label="요청 요약"
      className="flex h-fit w-full flex-col gap-section lg:w-80"
    >
      <Card className="flex flex-col gap-base">
        <div className="flex flex-col gap-tight">
          <h2 className="text-body-lg font-semibold">요청 요약</h2>
          <p className="text-label text-muted-foreground">
            제출 전 최종 내용을 확인하세요.
          </p>
        </div>

        <div className="flex flex-col gap-tight">
          <p className="text-label text-muted-foreground">전체 예상 금액</p>
          <p className="text-display font-semibold tabular-nums text-primary">
            {formatAmount(total)}
          </p>
        </div>

        <dl className="flex flex-col gap-snug border-t border-border pt-base text-body">
          <SummaryRow label="총 품목 수" value={`${itemCount}개`} />
          <SummaryRow
            label="우선순위"
            value={priorityLabels[priority] ?? priority}
          />
          <SummaryRow label="희망 기한" value={neededDate || "미지정"} />
        </dl>

        <div className="flex flex-col gap-snug border-t border-border pt-base">
          <Button disabled={busy !== "idle"} onClick={onSubmit} type="button">
            {busy === "submitting" ? "제출 중" : "구매 요청 제출"}
          </Button>
          <Button
            disabled={busy !== "idle"}
            onClick={onSaveDraft}
            type="button"
            variant="secondary"
          >
            {busy === "saving" ? "저장 중" : "임시 저장"}
          </Button>
          <Link
            className="text-center text-body text-muted-foreground underline"
            params={{ eventId }}
            to="/events/$eventId/purchase-requests/mine"
          >
            취소
          </Link>
        </div>
      </Card>

      {/* 와이어프레임 하단 안내 영역. 저장 결과도 여기 한 곳에서만 알린다. */}
      <div className="rounded-sm border border-primary-soft bg-primary-soft px-base py-snug">
        <p
          className="text-label leading-relaxed text-primary-soft-foreground"
          role="status"
        >
          {notice ?? "제출된 요청은 재정부의 검토 후 구매가 진행됩니다."}
        </p>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-base">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
