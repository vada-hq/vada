import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface DialogProps {
  children: ReactNode;
  /** 팝업 머리말 아래 한 줄. 이 화면이 무엇을 하는지 알린다. */
  description?: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}

/**
 * 화면을 이동하지 않고 여는 팝업이다. 여는 화면은 뒤에 그대로 남는다.
 * 머리말은 고정하고 본문 영역의 높이만 내준다. 구매 요청 작성처럼 본문과
 * 요약 패널이 한 form 안에서 각자 스크롤해야 하는 경우가 있어, 스크롤은
 * 여기서 걸지 않고 내용이 정한다.
 */
export function Dialog({ children, description, onClose, open, title }: DialogProps) {
  return (
    <BaseDialog.Root
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/40" />
        <BaseDialog.Popup
          className={cn(
            "fixed inset-0 z-50 m-auto flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)]",
            "max-w-6xl flex-col overflow-hidden rounded-md border border-border bg-card shadow-lg",
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-base border-b border-border px-loose py-base">
            <div className="flex flex-col gap-tight">
              <BaseDialog.Title className="text-title font-bold">
                {title}
              </BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="text-body text-muted-foreground">
                  {description}
                </BaseDialog.Description>
              ) : null}
            </div>
            <BaseDialog.Close
              aria-label={`${title} 닫기`}
              className="rounded-sm p-tight text-muted-foreground hover:text-foreground"
            >
              <svg
                aria-hidden="true"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </BaseDialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-background">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
