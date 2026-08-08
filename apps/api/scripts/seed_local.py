"""로컬에서 화면을 실제 데이터로 돌려 보기 위한 시드.

목업이 아니라 진짜 응답으로 화면을 보려면 볼 것이 있어야 한다. 빈 데이터베이스에
붙이면 빈 화면만 나오고 그것으로는 아무것도 확인되지 않는다.

이 스크립트는 개발용이다. 배포에서 실행하지 않는다. 안전장치 둘을 둔다.

1. `VADA_DATABASE_URL`이 없으면 아무것도 하지 않는다.
2. 그 데이터베이스에 이미 조직이 있으면 멈춘다. 지우고 다시 넣으려면 `--reset`을
   명시해야 하며, 그때도 이 시드가 만든 식별자만 지운다.

연결 문자열은 어디에도 찍지 않는다.
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, date, datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import Engine, create_engine

from vada_api.finance.persistence.schema import (
    purchase_request_item_review_events,
    purchase_request_item_revisions,
    purchase_request_items,
    purchase_requests,
)
from vada_api.identity.persistence.schema import (
    cognito_identities,
    department_memberships,
    event_finance_contexts,
    organization_departments,
    organization_events,
    organization_finance_memberships,
    organization_memberships,
    organizations,
    vada_users,
)

DATABASE_URL_ENVIRONMENT_VARIABLE = "VADA_DATABASE_URL"

# 목업 픽스처와 같은 식별자를 쓴다. 목에서 실제 서버로 바꿔 끼울 때 주소가
# 그대로여야 무엇이 달라졌는지 볼 수 있다.
ORGANIZATION = "organization-vada"
EVENT = "event-001"
ISSUER = "https://cognito-idp.ap-northeast-2.amazonaws.com/local-pool"

PLANNING = "department-planning"
OPERATIONS = "department-operations"
PROMOTION = "department-promotion"

PRESIDENT = "user-president"
FINANCE = "user-finance"
HEAD = "user-head"
MEMBER = "user-member"

REQUEST = "request-001"
SECOND_REQUEST = "request-002"

DECIDED_AT = datetime(2026, 8, 5, 3, 0, tzinfo=UTC)


def people() -> list[dict[str, object]]:
    """네 사람이 권한 축을 모두 덮는다.

    회장단·부서장·부원·재정부. 재정부는 직급이 아니라 부서 조건이므로 부원인
    사람에게 붙인다 — 그 조합이 실제로 도는지 봐야 한다.
    """
    return [
        {"user_id": PRESIDENT, "display_name": "박해랑", "role": "president"},
        {"user_id": FINANCE, "display_name": "최유나", "role": "member"},
        {"user_id": HEAD, "display_name": "김도윤", "role": "department_head"},
        {"user_id": MEMBER, "display_name": "이서준", "role": "member"},
    ]


def items() -> list[dict[str, object]]:
    """한 요청 안에 승인·보완 요청·반려가 함께 있다.

    재정 화면 다섯이 그 세 갈래를 모두 그린다. 하나만 있으면 나머지 두 열이
    비어 있는지 잘못 그리는지 구분되지 않는다.
    """
    return [
        {
            "item_id": "item-101",
            "request_id": REQUEST,
            "item_position": 0,
            "name": "음향 장비 대여",
            "category": "장비",
            "budget_item": "행사 운영비",
            "purchase_type": "rental",
            "quantity": Decimal(1),
            "unit": "식",
            "estimated_unit_price": Decimal(360_000),
            "details": {"provider": "", "location": "대운동장"},
        },
        {
            "item_id": "item-102",
            "request_id": REQUEST,
            "item_position": 1,
            "name": "행사 현수막 (5m)",
            "category": "인쇄물",
            "budget_item": "홍보비",
            "purchase_type": "manufacturing_printing",
            "quantity": Decimal(1),
            "unit": "장",
            "estimated_unit_price": Decimal(180_000),
            "details": {"itemKind": "현수막", "specification": "5m x 1m"},
        },
        {
            "item_id": "item-103",
            "request_id": REQUEST,
            "item_position": 2,
            "name": "기념품 텀블러 100개",
            "category": "기념품",
            "budget_item": "홍보비",
            "purchase_type": "general",
            "quantity": Decimal(100),
            "unit": "개",
            "estimated_unit_price": Decimal(8_500),
            "details": {
                "vendor": "쿠팡",
                "productUrl": "https://example.invalid/tumbler",
            },
        },
        # 두 번째 요청은 결정이 없다. `검토 중` 열에 같은 요청 카드가 둘 놓여
        # 스택으로 묶이는지 확인할 자리다.
        {
            "item_id": "item-201",
            "request_id": SECOND_REQUEST,
            "item_position": 0,
            "name": "포토존 배경 보드",
            "category": "제작물",
            "budget_item": "행사 운영비",
            "purchase_type": "manufacturing_printing",
            "quantity": Decimal(2),
            "unit": "개",
            "estimated_unit_price": Decimal(120_000),
            "details": {"itemKind": "배경 보드", "specification": "2m x 2m"},
        },
        {
            "item_id": "item-202",
            "request_id": SECOND_REQUEST,
            "item_position": 1,
            "name": "안내 표지판",
            "category": "제작물",
            "budget_item": "행사 운영비",
            "purchase_type": "manufacturing_printing",
            "quantity": Decimal(6),
            "unit": "개",
            "estimated_unit_price": Decimal(15_000),
            "details": {"itemKind": "표지판", "specification": "A1"},
        },
    ]


def reviews() -> list[dict[str, object]]:
    return [
        {
            "review_event_id": "review-101",
            "item_id": "item-101",
            "review_status": "revision_requested",
            "revision_reason": "견적 근거가 없습니다. 업체와 금액을 남겨 주세요.",
            "revision_due_date": date(2026, 9, 1),
            "rejection_reason": None,
        },
        {
            "review_event_id": "review-102",
            "item_id": "item-102",
            "review_status": "approved",
            "revision_reason": None,
            "revision_due_date": None,
            "rejection_reason": None,
        },
        {
            "review_event_id": "review-103",
            "item_id": "item-103",
            "review_status": "rejected",
            "revision_reason": None,
            "revision_due_date": None,
            "rejection_reason": "행사 예산 항목에 기념품이 없습니다.",
        },
    ]


def _delete_seeded(connection: sa.Connection) -> None:
    """이 시드가 만든 것만 지운다. 표를 통째로 비우지 않는다.

    같은 데이터베이스에 다른 데이터가 있을 수 있다. 지우는 범위를 식별자로
    좁혀 두면 잘못된 주소를 줬을 때 피해가 이 시드가 만든 것에 머문다.
    """
    for table in (
        purchase_request_item_revisions,
        purchase_request_item_review_events,
        purchase_request_items,
        purchase_requests,
    ):
        connection.execute(
            sa.delete(table).where(table.c.organization_id == ORGANIZATION)
        )
    for table in (
        event_finance_contexts,
        organization_finance_memberships,
        department_memberships,
        organization_memberships,
        organization_events,
        organization_departments,
    ):
        connection.execute(
            sa.delete(table).where(table.c.organization_id == ORGANIZATION)
        )
    user_ids = [person["user_id"] for person in people()]
    connection.execute(
        sa.delete(cognito_identities).where(cognito_identities.c.user_id.in_(user_ids))
    )
    connection.execute(sa.delete(vada_users).where(vada_users.c.user_id.in_(user_ids)))
    connection.execute(
        sa.delete(organizations).where(organizations.c.organization_id == ORGANIZATION)
    )


def seed(engine: Engine, *, reset: bool) -> None:
    with engine.begin() as connection:
        existing = connection.scalar(
            sa.select(sa.func.count())
            .select_from(organizations)
            .where(organizations.c.organization_id == ORGANIZATION)
        )
        if existing and not reset:
            raise SystemExit(
                "이미 시드가 들어 있습니다. 지우고 다시 넣으려면 --reset을 붙이세요."
            )
        if reset:
            _delete_seeded(connection)

        connection.execute(
            sa.insert(organizations),
            [{"organization_id": ORGANIZATION, "name": "소프트웨어융합대학 학생회"}],
        )
        connection.execute(
            sa.insert(vada_users),
            [
                {"user_id": p["user_id"], "display_name": p["display_name"]}
                for p in people()
            ],
        )
        # 로컬에는 API Gateway가 없다. VADA_LOCAL_PRINCIPAL_SUBJECT로 사람을
        # 바꿔 끼울 수 있게 네 사람 모두에게 신원을 만들어 둔다.
        connection.execute(
            sa.insert(cognito_identities),
            [
                {"issuer": ISSUER, "subject": p["user_id"], "user_id": p["user_id"]}
                for p in people()
            ],
        )
        connection.execute(
            sa.insert(organization_departments),
            [
                department(PLANNING, "기획부"),
                department(OPERATIONS, "운영부"),
                department(PROMOTION, "홍보부"),
            ],
        )
        connection.execute(
            sa.insert(organization_events),
            [
                {
                    "organization_id": ORGANIZATION,
                    "event_id": EVENT,
                    "name": "2026 가을 축제",
                }
            ],
        )
        connection.execute(
            sa.insert(organization_memberships),
            [
                {
                    "membership_id": f"membership-{p['user_id']}",
                    "organization_id": ORGANIZATION,
                    "user_id": p["user_id"],
                    "is_active": True,
                    "role": p["role"],
                }
                for p in people()
            ],
        )
        connection.execute(
            sa.insert(department_memberships),
            [
                # 이서준은 여기 없다. 부서 미배정도 조직의 구성원이고, 그 사람이
                # 화면에서 빠지지 않는지 봐야 한다.
                _relationship(PRESIDENT, PLANNING, is_head=True),
                _relationship(FINANCE, PLANNING, is_head=False),
                _relationship(HEAD, OPERATIONS, is_head=True),
                _relationship(HEAD, PROMOTION, is_head=False),
            ],
        )
        connection.execute(
            sa.insert(organization_finance_memberships),
            [
                {
                    "relationship_id": f"finance-{FINANCE}",
                    "organization_id": ORGANIZATION,
                    "membership_id": f"membership-{FINANCE}",
                    "user_id": FINANCE,
                    "is_active": True,
                }
            ],
        )
        connection.execute(
            sa.insert(event_finance_contexts),
            [
                {
                    "organization_id": ORGANIZATION,
                    "event_id": EVENT,
                    "available_budget": Decimal(0),
                }
            ],
        )

        connection.execute(
            sa.insert(purchase_requests),
            [
                _request(REQUEST, "가을 축제 운영 물품", Decimal(1_390_000)),
                _request(SECOND_REQUEST, "포토존 제작물", Decimal(330_000)),
            ],
        )
        connection.execute(
            sa.insert(purchase_request_items),
            [
                {
                    "organization_id": ORGANIZATION,
                    "event_id": EVENT,
                    "price_evidence": [],
                    **item,
                }
                for item in items()
            ],
        )
        connection.execute(
            sa.insert(purchase_request_item_review_events),
            [
                {
                    "organization_id": ORGANIZATION,
                    "event_id": EVENT,
                    "request_id": REQUEST,
                    "decided_by_user_id": FINANCE,
                    "decided_at": DECIDED_AT,
                    **review,
                }
                for review in reviews()
            ],
        )


def department(department_id: str, name: str) -> dict[str, object]:
    return {
        "organization_id": ORGANIZATION,
        "department_id": department_id,
        "name": name,
    }


def _relationship(
    user_id: str, department_id: str, *, is_head: bool
) -> dict[str, object]:
    return {
        "relationship_id": f"relationship-{user_id}-{department_id}",
        "organization_id": ORGANIZATION,
        "membership_id": f"membership-{user_id}",
        "user_id": user_id,
        "department_id": department_id,
        "is_active": True,
        "is_department_head": is_head,
    }


def _request(request_id: str, title: str, total: Decimal) -> dict[str, object]:
    return {
        "request_id": request_id,
        "organization_id": ORGANIZATION,
        "event_id": EVENT,
        "requester_user_id": HEAD,
        "request_department_id": OPERATIONS,
        "title": title,
        "needed_date": date(2026, 10, 15),
        "purpose": "행사 운영",
        "priority": "normal",
        # 요청 자체는 언제나 검토 대기다. 상태는 품목이 갖는다.
        "status": "review_pending",
        "estimated_total": total,
        # 배정을 만드는 흐름이 없어 배정은 0이다. 그것을 초과로 세지 않는다.
        "over_budget": False,
    }


def main() -> None:
    url = (os.getenv(DATABASE_URL_ENVIRONMENT_VARIABLE) or "").strip()
    if not url:
        raise SystemExit(
            f"{DATABASE_URL_ENVIRONMENT_VARIABLE}이 없습니다."
            " 개발용 데이터베이스 주소를 넣고 다시 실행하세요."
        )

    engine = create_engine(url)
    try:
        seed(engine, reset="--reset" in sys.argv[1:])
    finally:
        engine.dispose()

    # 주소는 찍지 않는다. 로그에 남으면 비밀이 아니게 된다.
    print("시드를 넣었습니다.")
    print(f"  조직 {ORGANIZATION} · 행사 {EVENT}")
    print("  사람을 바꾸려면 VADA_LOCAL_PRINCIPAL_SUBJECT를 아래 중 하나로 둡니다:")
    for person in people():
        print(f"    {person['user_id']:16} {person['display_name']} ({person['role']})")
    print(f"    {FINANCE} 는 재정부이기도 합니다.")


if __name__ == "__main__":
    main()
