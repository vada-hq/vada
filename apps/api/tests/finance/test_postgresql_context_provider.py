from decimal import Decimal

import pytest
from sqlalchemy.exc import SQLAlchemyError
from starlette.requests import Request

from vada_api.finance.persistence.context import (
    PostgreSQLPurchaseRequestContextProvider,
)
from vada_api.finance.submission import PurchaseRequestPersistenceError
from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    DepartmentRelationshipCandidate,
    OrganizationContextCandidate,
)
from vada_api.identity.errors import ResourceNotFoundError, UnauthenticatedError
from vada_api.identity.persistence.relationships import (
    PurchaseRequestRelationshipContext,
)


def _request(*, with_authorizer: bool = True) -> Request:
    scope: dict[str, object] = {
        "type": "http",
        "method": "GET",
        "path": "/events/event-a/purchase-request-editor",
        "headers": [],
    }
    if with_authorizer:
        scope["aws.event"] = {
            "requestContext": {
                "authorizer": {
                    "jwt": {
                        "claims": {
                            "iss": "https://cognito.example/pool-a",
                            "sub": "subject-a",
                            "token_use": "access",
                        }
                    }
                }
            }
        }
    return Request(scope)


class FakeRelationshipRepository:
    def find_internal_user_id(self, principal: CognitoPrincipal) -> str | None:
        if principal == CognitoPrincipal(
            issuer="https://cognito.example/pool-a",
            subject="subject-a",
        ):
            return "user-a"
        return None

    def find_active_organization_id_for_event(
        self, *, user_id: str, event_id: str
    ) -> str | None:
        if (user_id, event_id) == ("user-a", "event-a"):
            return "organization-a"
        return None

    def find_organization_context(
        self,
        *,
        user_id: str,
        organization_id: str,
        event_id: str,
    ) -> OrganizationContextCandidate | None:
        if (user_id, organization_id, event_id) != (
            "user-a",
            "organization-a",
            "event-a",
        ):
            return None
        return OrganizationContextCandidate(
            user_id="user-a",
            organization_id="organization-a",
            membership_id="membership-a",
            membership_is_active=True,
            event_id="event-a",
            event_organization_id="organization-a",
            department_relationships=(
                DepartmentRelationshipCandidate(
                    relationship_id="department-membership-a",
                    user_id="user-a",
                    membership_id="membership-a",
                    organization_id="organization-a",
                    department_id="department-a",
                    is_active=True,
                ),
            ),
        )

    def find_purchase_request_context(
        self,
        *,
        user_id: str,
        organization_id: str,
        membership_id: str,
        event_id: str,
    ) -> PurchaseRequestRelationshipContext | None:
        if (user_id, organization_id, membership_id, event_id) != (
            "user-a",
            "organization-a",
            "membership-a",
            "event-a",
        ):
            return None
        return PurchaseRequestRelationshipContext(
            event_name="개강 행사",
            requester_name="김민석",
            request_department_id="department-a",
            request_department_name="홍보부",
            available_budget=Decimal(100_000),
            department_head_of=frozenset({"department-a"}),
            is_finance_member=False,
        )


class FailingRelationshipRepository(FakeRelationshipRepository):
    def find_internal_user_id(self, principal: CognitoPrincipal) -> str | None:
        del principal
        raise SQLAlchemyError("database unavailable")


def test_resolves_api_gateway_identity_into_server_owned_finance_context() -> None:
    context = PostgreSQLPurchaseRequestContextProvider(
        FakeRelationshipRepository()
    ).resolve(_request(), event_id="event-a")

    assert context.actor.identity.user_id == "user-a"
    assert context.actor.identity.organization_id == "organization-a"
    assert context.actor.identity.event_id == "event-a"
    assert context.actor.department_head_of == frozenset({"department-a"})
    assert context.actor.finance_member_of == frozenset()
    assert context.event_name == "개강 행사"
    assert context.requester_name == "김민석"
    assert context.request_department_id == "department-a"
    assert context.request_department_name == "홍보부"
    assert context.available_budget == Decimal(100_000)


def test_missing_or_cross_scope_relationships_fail_closed() -> None:
    provider = PostgreSQLPurchaseRequestContextProvider(FakeRelationshipRepository())

    with pytest.raises(ResourceNotFoundError):
        provider.resolve(_request(), event_id="event-b")

    with pytest.raises(UnauthenticatedError):
        provider.resolve(_request(with_authorizer=False), event_id="event-a")


def test_database_failures_are_normalized_to_the_purchase_request_error_contract() -> (
    None
):
    provider = PostgreSQLPurchaseRequestContextProvider(FailingRelationshipRepository())

    with pytest.raises(PurchaseRequestPersistenceError):
        provider.resolve(_request(), event_id="event-a")
