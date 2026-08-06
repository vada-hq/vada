import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type {
  PurchaseRequestDraftContent,
  PurchaseRequestEditorState,
} from "@vada/api-client";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { formatAmount, formatCreatedDate } from "./display";
import {
  createEmptyItem,
  ItemCard,
  totalPreviewAmount,
  type DraftItem,
} from "./editor-items";
import { EditorError, editorStateQueryOptions } from "./editor-query";
import {
  CommandError,
  createIdempotencyKey,
  deleteDraft,
  saveDraft,
  submitRequest,
} from "./editor-commands";
import { validateEditorInput, type FieldError } from "./editor-validation";
import { OwnListLink } from "./navigation";

const priorities = [
  { value: "normal", label: "보통" },
  { value: "urgent", label: "긴급" },
];

/** 계약 DATA:purchase_request.draft@R1의 content에서 공통 정보만 다룬다. */
interface CommonInput {
  title: string;
  neededDate: string;
  purpose: string;
  priority: string;
}

const emptyCommonInput: CommonInput = {
  title: "",
  neededDate: "",
  purpose: "",
  priority: "normal",
};

function restoreCommonInput(content: PurchaseRequestDraftContent | undefined) {
  if (!content) return emptyCommonInput;

  return {
    title: content.title ?? "",
    neededDate: content.neededDate ?? "",
    purpose: content.purpose ?? "",
    priority: content.priority ?? "normal",
  };
}

export function PurchaseRequestEditorScreen({ eventId }: { eventId: string }) {
  const query = useQuery(editorStateQueryOptions(eventId));

  if (query.isPending) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <p role="status">작성 화면을 불러오는 중입니다.</p>
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <EditorFailureView
          error={query.error}
          eventId={eventId}
          onRetry={() => void query.refetch()}
        />
      </main>
    );
  }

  // 서버 맥락을 확인하기 전에는 폼을 열지 않는다.
  return <EditorForm eventId={eventId} state={query.data} />;
}

function EditorForm({
  eventId,
  state,
}: {
  eventId: string;
  state: PurchaseRequestEditorState;
}) {
  const [common, setCommon] = useState<CommonInput>(() =>
    restoreCommonInput(state.draft?.content),
  );
  const [items, setItems] = useState<DraftItem[]>(() => {
    const restored = state.draft?.content?.items;
    return restored?.length ? restored : [createEmptyItem()];
  });
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [draftVersion, setDraftVersion] = useState<number | null>(
    state.draft?.version ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<{
    message: string;
    retryable: boolean;
  } | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState<"idle" | "saving" | "submitting">("idle");
  // 같은 입력의 재시도는 같은 키를 쓰고, 입력이 바뀌면 새 키를 만든다.
  const submitKey = useRef<{ key: string; snapshot: string } | null>(null);
  const navigate = useNavigate();

  const total = totalPreviewAmount(items);

  const buildContent = () => ({
    title: common.title,
    neededDate: common.neededDate,
    purpose: common.purpose,
    priority: common.priority as "normal" | "urgent",
    items,
  });

  const describeFailure = (error: unknown, action: "save" | "submit") => {
    const kind = error instanceof CommandError ? error.failure : "not_found";

    if (kind === "conflict" && action === "save") {
      return {
        message:
          "다른 곳에서 초안이 바뀌었습니다. 저장되지 않았으니 최신 내용을 확인한 뒤 다시 저장해 주세요.",
        retryable: false,
      };
    }
    if (kind === "unavailable_temporarily") {
      return {
        message:
          action === "save"
            ? "저장되지 않았습니다. 잠시 후 다시 시도해 주세요."
            : "제출되지 않았습니다. 잠시 후 다시 시도해 주세요.",
        retryable: true,
      };
    }
    if (kind === "unauthenticated") {
      return { message: "다시 인증해야 합니다.", retryable: false };
    }
    if (action === "save") {
      return { message: "저장되지 않았습니다.", retryable: false };
    }
    return { message: "제출할 수 없습니다.", retryable: false };
  };

  const handleSaveDraft = async () => {
    setBusy("saving");
    setFailure(null);
    setNotice(null);
    try {
      const draft = await saveDraft(eventId, {
        expectedVersion: draftVersion,
        content: buildContent(),
      });
      setDraftVersion(draft.version);
      setNotice("임시 저장되었습니다. 제출 전에는 재정부 검토 목록에 표시되지 않습니다.");
    } catch (error) {
      setFailure(describeFailure(error, "save"));
    } finally {
      setBusy("idle");
    }
  };

  const handleDeleteDraft = async () => {
    setFailure(null);
    try {
      await deleteDraft(eventId);
      setDraftDismissed(true);
      setDraftVersion(null);
      // 현재 화면 입력은 자동으로 지우지 않는다.
      setNotice("서버 초안이 삭제됐습니다. 이후 저장은 새 초안으로 처리합니다.");
    } catch (error) {
      setFailure(describeFailure(error, "save"));
    }
  };

  const handleSubmit = async () => {
    const content = buildContent();
    const found = validateEditorInput(content);
    setErrors(found);
    if (found.length) return;

    const snapshot = JSON.stringify(content);
    if (!submitKey.current || submitKey.current.snapshot !== snapshot) {
      submitKey.current = { key: createIdempotencyKey(), snapshot };
    }

    setBusy("submitting");
    setFailure(null);
    try {
      const result = await submitRequest(eventId, content, submitKey.current.key);
      await navigate({
        params: { eventId },
        search: {
          submitted: result.requestId,
          overBudget: result.overBudget ? "1" : undefined,
        },
        to: "/events/$eventId/purchase-requests/mine",
      });
    } catch (error) {
      setFailure(describeFailure(error, "submit"));
    } finally {
      setBusy("idle");
    }
  };

  const update = (patch: Partial<CommonInput>) =>
    setCommon((current) => ({ ...current, ...patch }));

  const updateItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((current) =>
      current.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    );

  const removeItem = (index: number) =>
    setItems((current) => current.filter((_, position) => position !== index));

  const guardSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 한국어 IME 조합 중 Enter는 제출로 처리하지 않는다.
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) {
      return;
    }
    void handleSubmit();
  };

  return (
    <form
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row"
      noValidate
      onSubmit={guardSubmit}
    >
      <main className="flex min-w-0 flex-1 flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            구매 요청서 작성
          </h1>
          <p className="text-sm text-muted-foreground">
            행사 운영에 필요한 물품 또는 용역의 구매를 요청합니다.
          </p>
        </header>

        {state.draft && !draftDismissed ? (
          <DraftBanner
            onDismiss={() => void handleDeleteDraft()}
            savedAt={state.draft.savedAt}
          />
        ) : null}

        {notice ? (
          <p className="text-sm text-success" role="status">
            {notice}
          </p>
        ) : null}

        {failure ? (
          <Alert tone="danger" title="처리하지 못했습니다.">
            <p>{failure.message}</p>
            {failure.retryable ? (
              <Button
                className="mt-2"
                onClick={() => void handleSubmit()}
                type="button"
              >
                다시 시도
              </Button>
            ) : null}
          </Alert>
        ) : null}

        {errors.length ? <ErrorSummary errors={errors} /> : null}

        <Card className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold">기본 요청 정보</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="request-title" label="요청 제목" required>
              <Input
                onChange={(event) => update({ title: event.target.value })}
                value={common.title}
              />
            </FormField>

            <FormField
              description="작성자의 소속 부서로 고정됩니다."
              id="request-department"
              label="요청 부서"
            >
              {/* 서버가 준 값이며 사용자가 고르지 않는다. */}
              <Input disabled readOnly value={state.requestDepartmentName} />
            </FormField>

            <FormField id="request-needed-date" label="필요한 날짜" required>
              <Input
                onChange={(event) => update({ neededDate: event.target.value })}
                type="date"
                value={common.neededDate}
              />
            </FormField>

            <FormField id="request-priority" label="우선순위">
              <Select
                onValueChange={(value) => update({ priority: value })}
                options={priorities}
                value={common.priority}
              />
            </FormField>
          </div>

          <FormField id="request-purpose" label="구매 목적" required>
            <Input
              onChange={(event) => update({ purpose: event.target.value })}
              placeholder="예산을 사용하는 구체적인 이유와 용도를 설명해 주세요."
              value={common.purpose}
            />
          </FormField>
        </Card>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">품목 리스트</h2>
              <span className="text-xs text-muted-foreground">
                총 {items.length}개 품목
              </span>
            </span>
            <Button
              onClick={() => setItems((current) => [...current, createEmptyItem()])}
              type="button"
              variant="secondary"
            >
              품목 추가
            </Button>
          </div>

          <ul aria-label="품목 리스트" className="flex flex-col gap-4">
            {items.map((item, index) => (
              <ItemCard
                index={index}
                item={item}
                key={index}
                onChange={(patch) => updateItem(index, patch)}
                onRemove={() => removeItem(index)}
                removable={items.length > 1}
              />
            ))}
          </ul>
        </section>
      </main>

      <aside
        aria-label="요청 요약"
        className="flex h-fit w-full flex-col gap-6 lg:w-80"
      >
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">요청 요약</h2>
            <p className="text-xs text-muted-foreground">
              제출 전 최종 내용을 확인하세요.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">전체 예상 금액</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatAmount(total)}
            </p>
          </div>

          <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <SummaryRow label="총 품목 수" value={`${items.length}개`} />
            <SummaryRow
              label="우선순위"
              value={
                priorities.find((option) => option.value === common.priority)
                  ?.label ?? common.priority
              }
            />
            <SummaryRow
              label="희망 기한"
              value={common.neededDate || "미지정"}
            />
          </dl>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Button
              disabled={busy !== "idle"}
              onClick={() => void handleSubmit()}
              type="button"
            >
              {busy === "submitting" ? "제출 중" : "구매 요청 제출"}
            </Button>
            <Button
              disabled={busy !== "idle"}
              onClick={() => void handleSaveDraft()}
              type="button"
              variant="secondary"
            >
              {busy === "saving" ? "저장 중" : "임시 저장"}
            </Button>
            <Link
              className="text-center text-sm text-muted-foreground underline"
              params={{ eventId }}
                      to="/events/$eventId/purchase-requests/mine"
            >
              취소
            </Link>
          </div>
        </Card>
      </aside>
    </form>
  );
}

function ErrorSummary({ errors }: { errors: FieldError[] }) {
  return (
    <Alert aria-label="입력을 확인해 주세요" tone="danger" title="입력을 확인해 주세요">
      <ul className="mt-1 flex flex-col gap-1">
        {errors.map((error) => (
          <li key={error.controlId}>
            <a
              className="underline"
              href={`#${error.controlId}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(error.controlId)?.focus();
              }}
            >
              {error.label}
            </a>
            <span className="ml-2 text-current/80">{error.message}</span>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function DraftBanner({
  onDismiss,
  savedAt,
}: {
  onDismiss: () => void;
  savedAt: string;
}) {
  return (
    <div
      aria-label="초안 복원"
      className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-muted px-5 py-4"
      role="status"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          임시 저장한 구매 요청을 이어서 작성하고 있습니다
        </p>
        <p className="text-xs text-muted-foreground">
          {formatCreatedDate(savedAt)}에 저장됨 · 제출 전에는 재정부 검토 목록에
          표시되지 않습니다.
        </p>
      </div>
      <Button onClick={onDismiss} type="button" variant="secondary">
        초안 삭제
      </Button>
    </div>
  );
}

/** 오류 제목에 논리적 포커스를 둔다. */
function useErrorTitleFocus() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}

function EditorFailureView({
  error,
  eventId,
  onRetry,
}: {
  error: unknown;
  eventId: string;
  onRetry: () => void;
}) {
  const failure = error instanceof EditorError ? error.failure : "not_found";
  const titleRef = useErrorTitleFocus();

  const title =
    failure === "unauthenticated"
      ? "다시 인증해야 합니다."
      : failure === "forbidden"
        ? "작성 권한이 없습니다."
        : failure === "unavailable_temporarily"
          ? "작성 화면을 일시적으로 불러오지 못했습니다."
          : "행사를 찾을 수 없습니다.";

  const description =
    failure === "unauthenticated"
      ? "세션이 만료되어 작성 화면을 열 수 없습니다."
      : failure === "forbidden"
        ? "이 행사에서 구매 요청을 작성할 수 없습니다."
        : failure === "unavailable_temporarily"
          ? "잠시 후 다시 시도해 주세요."
          : "이미 종료되었거나 접근할 수 없는 행사입니다.";

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
