/**
 * 구매 요청 화면들이 공유하는 표시 규칙이다.
 * 목록과 상세가 같은 금액·날짜·상태 표기를 각자 다시 정의하지 않는다.
 */

const amountFormat = new Intl.NumberFormat("ko-KR");

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const statusLabels: Record<string, string> = {
  review_pending: "검토 대기",
};

export function formatAmount(value: number) {
  return `${amountFormat.format(value)}원`;
}

/** 저장은 UTC, 표시는 KST 날짜만 사용한다. */
export function formatCreatedDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return dateFormat.format(parsed).replaceAll(". ", "-").replace(".", "");
}

/** 계약에 없는 상태는 만들어 붙이지 않고 서버 값을 그대로 노출한다. */
export function formatStatus(status: string) {
  return statusLabels[status] ?? status;
}
