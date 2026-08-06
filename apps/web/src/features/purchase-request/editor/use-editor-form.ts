import { useNavigate } from "@tanstack/react-router";
import type {
  PurchaseRequestDraftContent,
  PurchaseRequestEditorState,
} from "@vada/api-client";
import { useRef, useState } from "react";

import { failureOf, type ApiFailure } from "../../../shared/api/failure";
import type { FieldError } from "../../../shared/screen/states";
import {
  createIdempotencyKey,
  deleteDraft,
  saveDraft,
  submitRequest,
} from "./commands";
import { createEmptyItem, type DraftItem } from "./items";
import { validateEditorInput } from "./validation";

export interface CommonInput {
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

function describeFailure(failure: ApiFailure, action: "save" | "submit") {
  if (failure === "conflict" && action === "save") {
    return {
      message:
        "다른 곳에서 초안이 바뀌었습니다. 저장되지 않았으니 최신 내용을 확인한 뒤 다시 저장해 주세요.",
      retryable: false,
    };
  }
  if (failure === "unavailable_temporarily") {
    return {
      message:
        action === "save"
          ? "저장되지 않았습니다. 잠시 후 다시 시도해 주세요."
          : "제출되지 않았습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
    };
  }
  if (failure === "unauthenticated") {
    return { message: "다시 인증해야 합니다.", retryable: false };
  }
  return {
    message: action === "save" ? "저장되지 않았습니다." : "제출할 수 없습니다.",
    retryable: false,
  };
}

/**
 * 작성 화면의 입력과 서버 명령을 한 곳에서 다룬다.
 * 화면 컴포넌트는 표시에만 집중한다.
 */
export function useEditorForm(
  eventId: string,
  state: PurchaseRequestEditorState,
) {
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

  const buildContent = (): PurchaseRequestDraftContent => ({
    title: common.title,
    neededDate: common.neededDate,
    purpose: common.purpose,
    priority: common.priority as "normal" | "urgent",
    items,
  });

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
      setNotice(
        "임시 저장되었습니다. 제출 전에는 재정부 검토 목록에 표시되지 않습니다.",
      );
    } catch (error) {
      setFailure(describeFailure(failureOf(error), "save"));
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
      setFailure(describeFailure(failureOf(error), "save"));
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
          ...(result.overBudget ? { overBudget: "1" as const } : {}),
        },
        to: "/events/$eventId/purchase-requests/mine",
      });
    } catch (error) {
      setFailure(describeFailure(failureOf(error), "submit"));
    } finally {
      setBusy("idle");
    }
  };

  return {
    busy,
    common,
    draftDismissed,
    errors,
    failure,
    handleDeleteDraft,
    handleSaveDraft,
    handleSubmit,
    items,
    notice,
    setItems,
    updateCommon: (patch: Partial<CommonInput>) =>
      setCommon((current) => ({ ...current, ...patch })),
  };
}
