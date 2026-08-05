# pyright: reportUnknownMemberType=false
from __future__ import annotations

from collections.abc import Generator
from decimal import Decimal
from typing import cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError
from starlette.types import ASGIApp, Receive, Scope, Send

from vada_api.finance.application import PurchaseRequestRelationshipReader
from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    IdentityContextResolver,
    RequestedOrganizationScope,
)
from vada_api.identity.errors import ResourceNotFoundError
from vada_api.identity.persistence.relationships import (
    PostgreSQLIdentityOrganizationRepository,
)
from vada_api.main import create_app


@pytest.fixture(autouse=True)
def clean_identity_relationships(migrated_engine: Engine) -> Generator[None]:
    tables = """
        purchase_request_submission_events,
        purchase_request_submission_idempotency,
        purchase_request_items,
        purchase_requests,
        purchase_request_drafts,
        event_finance_contexts,
        organization_finance_memberships,
        department_memberships,
        organization_departments,
        organization_events,
        organization_memberships,
        organizations,
        cognito_identities,
        vada_users
    """
    with migrated_engine.begin() as connection:
        connection.execute(text(f"TRUNCATE TABLE {tables} CASCADE"))
    yield
    with migrated_engine.begin() as connection:
        connection.execute(text(f"TRUNCATE TABLE {tables} CASCADE"))


def _seed_relationships(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO vada_users (user_id, display_name)
                VALUES
                    ('user-a', '김민석'),
                    ('user-b', '박서연'),
                    ('user-c', '현재 조회자');

                INSERT INTO cognito_identities (issuer, subject, user_id)
                VALUES
                    ('https://cognito.example/pool-a', 'subject-a', 'user-a'),
                    ('https://cognito.example/pool-a', 'subject-b', 'user-b'),
                    ('https://cognito.example/pool-a', 'subject-c', 'user-c');

                INSERT INTO organizations (organization_id, name)
                VALUES ('organization-a', '학생회 A'), ('organization-b', '학생회 B');

                INSERT INTO organization_memberships (
                    membership_id, organization_id, user_id, is_active
                )
                VALUES
                    ('membership-a', 'organization-a', 'user-a', true),
                    ('membership-b', 'organization-b', 'user-b', true),
                    ('membership-c', 'organization-a', 'user-c', true);

                INSERT INTO organization_events (organization_id, event_id, name)
                VALUES
                    ('organization-a', 'event-a', '개강 행사'),
                    ('organization-b', 'event-b', '다른 조직 행사');

                INSERT INTO organization_departments (
                    organization_id, department_id, name
                )
                VALUES
                    ('organization-a', 'department-a', '홍보부'),
                    ('organization-b', 'department-b', '기획부');

                INSERT INTO department_memberships (
                    relationship_id,
                    organization_id,
                    membership_id,
                    user_id,
                    department_id,
                    is_active,
                    is_department_head
                )
                VALUES
                    (
                        'department-membership-a',
                        'organization-a',
                        'membership-a',
                        'user-a',
                        'department-a',
                        true,
                        true
                    ),
                    (
                        'department-membership-b',
                        'organization-b',
                        'membership-b',
                        'user-b',
                        'department-b',
                        true,
                        false
                    ),
                    (
                        'department-membership-c',
                        'organization-a',
                        'membership-c',
                        'user-c',
                        'department-a',
                        true,
                        false
                    );

                INSERT INTO organization_finance_memberships (
                    relationship_id,
                    organization_id,
                    membership_id,
                    user_id,
                    is_active
                )
                VALUES (
                    'finance-membership-b',
                    'organization-b',
                    'membership-b',
                    'user-b',
                    true
                );

                INSERT INTO event_finance_contexts (
                    organization_id, event_id, available_budget
                )
                VALUES
                    ('organization-a', 'event-a', 100000),
                    ('organization-b', 'event-b', 200000);
                """
            )
        )


def _seed_purchase_request(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO purchase_requests (
                    request_id,
                    organization_id,
                    event_id,
                    requester_user_id,
                    request_department_id,
                    title,
                    needed_date,
                    purpose,
                    priority,
                    status,
                    estimated_total,
                    over_budget,
                    created_at
                )
                VALUES (
                    'request-001',
                    'organization-a',
                    'event-a',
                    'user-a',
                    'department-a',
                    '행사 운영 물품',
                    DATE '2026-08-20',
                    '행사 운영',
                    'normal',
                    'review_pending',
                    10000,
                    false,
                    TIMESTAMPTZ '2026-08-05 00:00:00+00'
                );

                INSERT INTO purchase_request_items (
                    item_id,
                    organization_id,
                    event_id,
                    request_id,
                    item_position,
                    name,
                    category,
                    budget_item,
                    purchase_type,
                    quantity,
                    unit,
                    estimated_unit_price,
                    price_evidence,
                    details
                )
                VALUES (
                    'item-001',
                    'organization-a',
                    'event-a',
                    'request-001',
                    0,
                    '현수막',
                    '홍보물',
                    '행사운영비',
                    'general',
                    1,
                    '개',
                    10000,
                    '[{"type":"product_url","url":"https://example.test/banner"}]'::jsonb,
                    '{"vendor":"공급처 A"}'::jsonb
                );
                """
            )
        )


def _principal(subject: str = "subject-a") -> CognitoPrincipal:
    return CognitoPrincipal(
        issuer="https://cognito.example/pool-a",
        subject=subject,
    )


def _claims(subject: str = "subject-a") -> dict[str, object]:
    return {
        "authorizer": {
            "jwt": {
                "claims": {
                    "iss": "https://cognito.example/pool-a",
                    "sub": subject,
                    "token_use": "access",
                }
            }
        }
    }


class _ApiGatewayContextApp:
    def __init__(self, application: ASGIApp, *, subject: str) -> None:
        self._application = application
        self._subject = subject

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        request_scope = dict(scope)
        if scope["type"] == "http":
            request_scope["aws.event"] = {"requestContext": _claims(self._subject)}
        await self._application(request_scope, receive, send)


def _client(
    engine: Engine, *, subject: str = "subject-a"
) -> tuple[TestClient, FastAPI]:
    application = create_app(engine=engine)
    return TestClient(_ApiGatewayContextApp(application, subject=subject)), application


def _get(client: TestClient, path: str) -> Response:
    return cast(Response, client.get(path))


@pytest.mark.postgres
def test_postgresql_relationships_resolve_identity_context_and_display_names(
    migrated_engine: Engine,
) -> None:
    _seed_relationships(migrated_engine)
    repository = PostgreSQLIdentityOrganizationRepository(migrated_engine)

    assert repository.find_internal_user_id(_principal()) == "user-a"
    assert (
        repository.find_active_organization_id_for_event(
            user_id="user-a", event_id="event-a"
        )
        == "organization-a"
    )
    identity = IdentityContextResolver(repository).resolve(
        _claims(),
        RequestedOrganizationScope(
            organization_id="organization-a",
            event_id="event-a",
        ),
    )
    finance = repository.find_purchase_request_context(
        user_id=identity.user_id,
        organization_id=identity.organization_id,
        membership_id=identity.membership_id,
        event_id=identity.event_id,
    )
    assert finance is not None
    assert finance.event_name == "개강 행사"
    assert finance.requester_name == "김민석"
    assert finance.request_department_id == "department-a"
    assert finance.request_department_name == "홍보부"
    assert finance.available_budget == Decimal(100_000)
    assert finance.department_head_of == frozenset({"department-a"})
    assert finance.is_finance_member is False

    assert (
        repository.find_display_names(
            organization_id="organization-a",
            event_id="event-a",
            requester_user_id="user-a",
        )
        is not None
    )
    assert (
        repository.find_display_names(
            organization_id="organization-b",
            event_id="event-b",
            requester_user_id="user-a",
        )
        is None
    )


@pytest.mark.postgres
def test_production_app_composition_uses_postgresql_relationships_and_fails_closed(
    migrated_engine: Engine,
) -> None:
    _seed_relationships(migrated_engine)
    client, application = _client(migrated_engine)

    with client:
        response = _get(client, "/events/event-a/purchase-request-editor")
        cross_scope = _get(client, "/events/event-b/purchase-request-editor")

    assert response.status_code == 200
    assert response.json() == {
        "organizationId": "organization-a",
        "eventId": "event-a",
        "eventName": "개강 행사",
        "requesterUserId": "user-a",
        "requesterName": "김민석",
        "requestDepartmentId": "department-a",
        "requestDepartmentName": "홍보부",
        "draft": None,
    }
    assert cross_scope.status_code == 404
    assert cross_scope.json()["code"] == "RESOURCE_NOT_FOUND"

    unlinked_client, _ = _client(migrated_engine, subject="unlinked-subject")
    with unlinked_client:
        unlinked = _get(unlinked_client, "/events/event-a/purchase-request-editor")
    assert unlinked.status_code == 401
    assert unlinked.json()["code"] == "UNAUTHENTICATED"

    reader = cast(
        PurchaseRequestRelationshipReader,
        application.state.purchase_request_relationship_reader,
    )
    names = reader.get_detail_display_names(
        organization_id="organization-a",
        event_id="event-a",
        requester_user_id="user-a",
    )
    assert names is not None
    assert (names.event_name, names.requester_name) == ("개강 행사", "김민석")


@pytest.mark.postgres
def test_production_detail_uses_stored_relationships_and_preserves_tenant_boundary(
    migrated_engine: Engine,
) -> None:
    _seed_relationships(migrated_engine)
    _seed_purchase_request(migrated_engine)
    application = create_app(engine=migrated_engine)
    owner = TestClient(_ApiGatewayContextApp(application, subject="subject-a"))
    same_org_member = TestClient(
        _ApiGatewayContextApp(application, subject="subject-c")
    )
    other_org_member = TestClient(
        _ApiGatewayContextApp(application, subject="subject-b")
    )
    path = "/events/event-a/purchase-requests/request-001"

    with owner, same_org_member, other_org_member:
        owner_detail = _get(owner, path)
        member_detail = _get(same_org_member, path)
        hidden = _get(other_org_member, path)

    assert owner_detail.status_code == 200
    assert member_detail.status_code == 200
    assert member_detail.json() == owner_detail.json()
    assert owner_detail.json()["record"]["requestId"] == "request-001"
    assert owner_detail.json()["display"] == {
        "eventName": "개강 행사",
        "requesterName": "김민석",
    }
    assert owner_detail.json()["display"]["requesterName"] != "현재 조회자"
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "RESOURCE_NOT_FOUND"

    with migrated_engine.begin() as connection:
        connection.execute(
            text(
                """
                DELETE FROM department_memberships
                WHERE organization_id = 'organization-a'
                  AND user_id = 'user-a';

                DELETE FROM organization_memberships
                WHERE organization_id = 'organization-a'
                  AND user_id = 'user-a'
                """
            )
        )

    with same_org_member:
        unavailable = _get(same_org_member, path)
    assert unavailable.status_code == 503
    assert unavailable.json()["code"] == "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE"


@pytest.mark.postgres
def test_inactive_and_cross_organization_relationships_are_not_trusted(
    migrated_engine: Engine,
) -> None:
    _seed_relationships(migrated_engine)
    repository = PostgreSQLIdentityOrganizationRepository(migrated_engine)

    with migrated_engine.begin() as connection:
        connection.execute(
            text(
                """
                UPDATE organization_memberships
                SET is_active = false
                WHERE organization_id = 'organization-a'
                  AND membership_id = 'membership-a'
                """
            )
        )

    assert (
        repository.find_active_organization_id_for_event(
            user_id="user-a", event_id="event-a"
        )
        is None
    )
    with pytest.raises(ResourceNotFoundError):
        IdentityContextResolver(repository).resolve(
            _claims(),
            RequestedOrganizationScope(
                organization_id="organization-a",
                event_id="event-a",
            ),
        )

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO department_memberships (
                    relationship_id,
                    organization_id,
                    membership_id,
                    user_id,
                    department_id,
                    is_active,
                    is_department_head
                )
                VALUES (
                    'cross-scope',
                    'organization-b',
                    'membership-a',
                    'user-a',
                    'department-b',
                    true,
                    true
                )
                """
            )
        )
