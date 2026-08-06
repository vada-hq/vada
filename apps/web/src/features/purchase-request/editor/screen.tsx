import { useQuery } from "@tanstack/react-query";
import type { PurchaseRequestEditorState } from "@vada/api-client";
import type { FormEvent } from "react";

import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import {
  ErrorSummary,
  FailureState,
  LoadingState,
} from "../../../shared/screen/states";
import { Page, PageHeader, SectionHeading } from "../../../shared/ui/page";
import { formatCreatedDate } from "../shared/display";
import { OwnListLink } from "../shared/navigation";
import { createEmptyItem, ItemCard, totalPreviewAmount } from "./items";
import { editorStateQueryOptions } from "./query";
import { EditorSummaryPanel } from "./summary-panel";
import { useEditorForm } from "./use-editor-form";

const priorities = [
  { value: "normal", label: "보통" },
  { value: "urgent", label: "긴급" },
];

function describeFailure(failure: ApiFailure) {
  if (failure === "unauthenticated") {
    return {
      title: "다시 인증해야 합니다.",
      description: "세션이 만료되어 작성 화면을 열 수 없습니다.",
    };
  }
  if (failure === "forbidden") {
    return {
      title: "작성 권한이 없습니다.",
      description: "이 행사에서 구매 요청을 작성할 수 없습니다.",
    };
  }
  if (failure === "unavailable_temporarily") {
    return {
      title: "작성 화면을 일시적으로 불러오지 못했습니다.",
      description: "잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    title: "행사를 찾을 수 없습니다.",
    description: "이미 종료되었거나 접근할 수 없는 행사입니다.",
  };
}

export function PurchaseRequestEditorScreen({ eventId }: { eventId: string }) {
  const query = useQuery(editorStateQueryOptions(eventId));

  if (query.isPending) {
    return (
      <Page>
        <LoadingState label="작성 화면을 불러오는 중입니다." />
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
  const form = useEditorForm(eventId, state);
  const total = totalPreviewAmount(form.items);

  const guardSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 한국어 IME 조합 중 Enter는 제출로 처리하지 않는다.
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) {
      return;
    }
    void form.handleSubmit();
  };

  return (
    <form
      className="mx-auto flex w-full max-w-6xl flex-col gap-section px-base py-section lg:flex-row"
      noValidate
      onSubmit={guardSubmit}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-section">
        <PageHeader
          description="행사 운영에 필요한 물품 또는 용역의 구매를 요청합니다."
          title="구매 요청서 작성"
        />

        {state.draft && !form.draftDismissed ? (
          <DraftBanner
            onDismiss={() => void form.handleDeleteDraft()}
            savedAt={state.draft.savedAt}
          />
        ) : null}

        {form.notice ? (
          <p className="text-body text-success" role="status">
            {form.notice}
          </p>
        ) : null}

        {form.failure ? (
          <Alert tone="danger" title="처리하지 못했습니다.">
            <p>{form.failure.message}</p>
            {form.failure.retryable ? (
              <Button
                className="mt-tight"
                onClick={() => void form.handleSubmit()}
                type="button"
              >
                다시 시도
              </Button>
            ) : null}
          </Alert>
        ) : null}

        <ErrorSummary errors={form.errors} />

        <Card className="flex flex-col gap-loose">
          <h2 className="text-body-lg font-semibold">기본 요청 정보</h2>

          <div className="grid gap-loose sm:grid-cols-2">
            <FormField id="request-title" label="요청 제목" required>
              <Input
                onChange={(event) =>
                  form.updateCommon({ title: event.target.value })
                }
                value={form.common.title}
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
                onChange={(event) =>
                  form.updateCommon({ neededDate: event.target.value })
                }
                type="date"
                value={form.common.neededDate}
              />
            </FormField>

            <FormField id="request-priority" label="우선순위">
              <Select
                onValueChange={(value) => form.updateCommon({ priority: value })}
                options={priorities}
                value={form.common.priority}
              />
            </FormField>
          </div>

          <FormField id="request-purpose" label="구매 목적" required>
            <Input
              onChange={(event) =>
                form.updateCommon({ purpose: event.target.value })
              }
              placeholder="예산을 사용하는 구체적인 이유와 용도를 설명해 주세요."
              value={form.common.purpose}
            />
          </FormField>
        </Card>

        <section className="flex flex-col gap-base">
          <SectionHeading
            actions={
              <Button
                onClick={() =>
                  form.setItems((current) => [...current, createEmptyItem()])
                }
                type="button"
                variant="secondary"
              >
                품목 추가
              </Button>
            }
            meta={`총 ${form.items.length}개 품목`}
          >
            품목 리스트
          </SectionHeading>

          <ul aria-label="품목 리스트" className="flex flex-col gap-base">
            {form.items.map((item, index) => (
              <ItemCard
                index={index}
                item={item}
                key={index}
                onChange={(patch) =>
                  form.setItems((current) =>
                    current.map((entry, position) =>
                      position === index ? { ...entry, ...patch } : entry,
                    ),
                  )
                }
                onRemove={() =>
                  form.setItems((current) =>
                    current.filter((_, position) => position !== index),
                  )
                }
                removable={form.items.length > 1}
              />
            ))}
          </ul>
        </section>
      </div>

      <EditorSummaryPanel
        busy={form.busy}
        eventId={eventId}
        itemCount={form.items.length}
        neededDate={form.common.neededDate}
        onSaveDraft={() => void form.handleSaveDraft()}
        onSubmit={() => void form.handleSubmit()}
        priority={form.common.priority}
        total={total}
      />
    </form>
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
      className="flex flex-wrap items-center justify-between gap-base rounded-md border border-border bg-primary-soft px-surface py-base"
      role="status"
    >
      <div className="flex flex-col gap-tight">
        <p className="text-body font-medium text-primary-soft-foreground">
          임시 저장한 구매 요청을 이어서 작성하고 있습니다
        </p>
        <p className="text-label text-primary-soft-foreground/80">
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
