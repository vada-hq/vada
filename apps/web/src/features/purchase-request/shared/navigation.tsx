import { Link } from "@tanstack/react-router";

/**
 * 행사 재정 화면은 DU-001 범위 밖이라 라우트를 만들지 않고 경로만 연결한다.
 * 목록·상세가 같은 복귀 행동을 각자 다시 정의하지 않도록 한곳에 둔다.
 */
export function EventFinanceLink({ eventId }: { eventId: string }) {
  return (
    <a
      className="mt-tight inline-block text-body underline"
      href={`/events/${encodeURIComponent(eventId)}/finance`}
    >
      행사 재정으로 돌아가기
    </a>
  );
}

export function OwnListLink({ eventId }: { eventId: string }) {
  return (
    <Link
      className="mt-tight inline-block text-body underline"
      params={{ eventId }}
      to="/events/$eventId/purchase-requests/mine"
    >
      내 구매 요청 목록으로
    </Link>
  );
}
