import { useEffect, useRef, type ReactNode } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { isRetryable, type ApiFailure } from "../api/failure";

/** 진행 중임을 알린다. 서버 응답 전 샘플 값을 결과처럼 보여주지 않는다. */
export function LoadingState({ label }: { label: string }) {
  return (
    <p className="text-body text-muted-foreground" role="status">
      {label}
    </p>
  );
}

/** 결과가 없음을 알린다. 명세는 빈 결과도 status로 전달하도록 요구한다. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className="text-body" role="status">
        {children}
      </p>
    </Card>
  );
}

/** 명세는 오류 제목에 논리적 포커스를 두도록 요구한다. */
function useErrorTitleFocus() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}

export interface FailureStateProps {
  /** 화면마다 안내 문구가 다르므로 실패별 제목과 설명을 받는다. */
  describe: (failure: ApiFailure) => { title: string; description: string };
  actions?: ReactNode;
  failure: ApiFailure;
  onRetry?: () => void;
}

export function FailureState({
  actions,
  describe,
  failure,
  onRetry,
}: FailureStateProps) {
  const titleRef = useErrorTitleFocus();
  const { description, title } = describe(failure);

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
      {onRetry && isRetryable(failure) ? (
        <Button className="mt-tight" onClick={onRetry} type="button">
          다시 시도
        </Button>
      ) : null}
      {actions}
    </Alert>
  );
}

export interface FieldError {
  controlId: string;
  label: string;
  message: string;
}

/**
 * 오류 요약. 명세는 오류 발생만으로 포커스를 옮기지 않고
 * 요약의 항목을 고를 때만 해당 입력으로 이동하도록 요구한다.
 */
export function ErrorSummary({
  errors,
  title = "입력을 확인해 주세요",
}: {
  errors: FieldError[];
  title?: string;
}) {
  if (!errors.length) return null;

  return (
    <Alert aria-label={title} tone="danger" title={title}>
      <ul className="mt-tight flex flex-col gap-tight">
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
            <span className="ml-snug text-current/80">{error.message}</span>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
