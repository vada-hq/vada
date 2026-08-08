from collections.abc import Mapping

import pytest

from vada_api.identity import (
    CognitoPrincipal,
    DepartmentRelationshipCandidate,
    IdentityContextRepository,
    IdentityContextResolver,
    OrganizationContextCandidate,
    OrganizationOnlyContextCandidate,
    RequestedOrganizationScope,
    ResourceNotFoundError,
    UnauthenticatedError,
)


def api_gateway_request_context(
    *,
    subject: object = "cognito-subject-a",
    issuer: object = "https://cognito-idp.ap-northeast-2.amazonaws.com/pool-a",
    use_value: object = "access",
) -> dict[str, object]:
    return {
        "authorizer": {
            "jwt": {
                "claims": {
                    "sub": subject,
                    "iss": issuer,
                    "token_use": use_value,
                }
            }
        }
    }


def organization_candidate(
    *,
    organization_id: str = "organization-a",
    event_id: str = "event-a",
    membership_active: bool = True,
    departments: tuple[DepartmentRelationshipCandidate, ...] | None = None,
) -> OrganizationContextCandidate:
    if departments is None:
        departments = (
            DepartmentRelationshipCandidate(
                relationship_id="department-relationship-a",
                user_id="user-a",
                membership_id="membership-a",
                organization_id=organization_id,
                department_id="department-a",
                is_active=True,
            ),
        )
    return OrganizationContextCandidate(
        user_id="user-a",
        organization_id=organization_id,
        membership_id="membership-a",
        membership_is_active=membership_active,
        event_id=event_id,
        event_organization_id=organization_id,
        department_relationships=departments,
    )


class FakeIdentityContextRepository(IdentityContextRepository):
    def __init__(self) -> None:
        self.user_ids: dict[CognitoPrincipal, str] = {}
        self.contexts: dict[tuple[str, str, str], OrganizationContextCandidate] = {}
        self.identity_lookups: list[CognitoPrincipal] = []
        self.context_lookups: list[tuple[str, str, str]] = []

    def find_internal_user_id(self, principal: CognitoPrincipal) -> str | None:
        self.identity_lookups.append(principal)
        return self.user_ids.get(principal)

    def find_organization_context(
        self,
        *,
        user_id: str,
        organization_id: str,
        event_id: str,
    ) -> OrganizationContextCandidate | None:
        key = (user_id, organization_id, event_id)
        self.context_lookups.append(key)
        return self.contexts.get(key)

    def find_organization_only_context(
        self, *, user_id: str, organization_id: str
    ) -> OrganizationOnlyContextCandidate | None:
        # 이 테스트는 행사 있는 경로만 본다. 조직 전용 경로에는 자기 테스트가 있다.
        raise AssertionError("이 테스트에서 쓰지 않는다.")


def linked_repository() -> FakeIdentityContextRepository:
    repository = FakeIdentityContextRepository()
    repository.user_ids[
        CognitoPrincipal(
            issuer="https://cognito-idp.ap-northeast-2.amazonaws.com/pool-a",
            subject="cognito-subject-a",
        )
    ] = "user-a"
    return repository


def test_resolves_verified_cognito_principal_to_trusted_organization_context() -> None:
    repository = linked_repository()
    repository.contexts[("user-a", "organization-a", "event-a")] = (
        organization_candidate(
            departments=(
                DepartmentRelationshipCandidate(
                    relationship_id="department-relationship-a",
                    user_id="user-a",
                    membership_id="membership-a",
                    organization_id="organization-a",
                    department_id="department-a",
                    is_active=True,
                ),
                DepartmentRelationshipCandidate(
                    relationship_id="department-relationship-old",
                    user_id="user-a",
                    membership_id="membership-a",
                    organization_id="organization-a",
                    department_id="department-old",
                    is_active=False,
                ),
            )
        )
    )

    context = IdentityContextResolver(repository).resolve(
        api_gateway_request_context(),
        RequestedOrganizationScope(
            organization_id="organization-a",
            event_id="event-a",
        ),
    )

    assert context.principal.subject == "cognito-subject-a"
    assert context.principal.issuer.endswith("/pool-a")
    assert context.user_id == "user-a"
    assert context.organization_id == "organization-a"
    assert context.membership_id == "membership-a"
    assert context.has_active_organization_membership is True
    assert context.event_id == "event-a"
    assert context.department_ids == frozenset({"department-a"})
    assert repository.context_lookups == [("user-a", "organization-a", "event-a")]


@pytest.mark.parametrize(
    "request_context",
    [
        {},
        {"authorizer": {}},
        {"authorizer": {"jwt": {}}},
        {"authorizer": {"jwt": {"claims": {}}}},
        api_gateway_request_context(subject=""),
        api_gateway_request_context(subject=123),
        api_gateway_request_context(issuer=""),
        api_gateway_request_context(use_value="id"),
    ],
)
def test_rejects_missing_or_invalid_authorizer_claims_without_disclosure(
    request_context: Mapping[str, object],
) -> None:
    repository = FakeIdentityContextRepository()

    with pytest.raises(UnauthenticatedError) as error:
        IdentityContextResolver(repository).resolve(
            request_context,
            RequestedOrganizationScope(
                organization_id="organization-a",
                event_id="event-a",
            ),
        )

    assert error.value.http_status == 401
    assert error.value.code == "UNAUTHENTICATED"
    assert repository.identity_lookups == []
    assert repository.context_lookups == []


def test_rejects_valid_but_unlinked_principal_as_unauthenticated() -> None:
    repository = FakeIdentityContextRepository()

    with pytest.raises(UnauthenticatedError) as error:
        IdentityContextResolver(repository).resolve(
            api_gateway_request_context(subject="unlinked-cognito-subject"),
            RequestedOrganizationScope(
                organization_id="organization-a",
                event_id="event-a",
            ),
        )

    assert error.value.http_status == 401
    assert error.value.code == "UNAUTHENTICATED"
    assert "unlinked-cognito-subject" not in str(error.value)
    assert repository.context_lookups == []


def test_internal_user_link_is_scoped_by_cognito_issuer_and_subject() -> None:
    repository = linked_repository()

    with pytest.raises(UnauthenticatedError):
        IdentityContextResolver(repository).resolve(
            api_gateway_request_context(
                issuer="https://cognito-idp.ap-northeast-2.amazonaws.com/pool-b"
            ),
            RequestedOrganizationScope(
                organization_id="organization-a",
                event_id="event-a",
            ),
        )

    assert repository.identity_lookups == [
        CognitoPrincipal(
            issuer="https://cognito-idp.ap-northeast-2.amazonaws.com/pool-b",
            subject="cognito-subject-a",
        )
    ]
    assert repository.context_lookups == []


@pytest.mark.parametrize(
    "candidate",
    [
        organization_candidate(membership_active=False),
        organization_candidate(departments=()),
    ],
)
def test_incomplete_active_relationships_fail_closed(
    candidate: OrganizationContextCandidate,
) -> None:
    repository = linked_repository()
    repository.contexts[("user-a", "organization-a", "event-a")] = candidate

    with pytest.raises(ResourceNotFoundError) as error:
        IdentityContextResolver(repository).resolve(
            api_gateway_request_context(),
            RequestedOrganizationScope(
                organization_id="organization-a",
                event_id="event-a",
            ),
        )

    assert error.value.http_status == 404
    assert error.value.code == "RESOURCE_NOT_FOUND"


def test_cross_organization_event_and_department_facts_do_not_leak() -> None:
    missing_repository = linked_repository()
    cross_event_repository = linked_repository()
    cross_event_candidate = organization_candidate(organization_id="organization-b")
    cross_event_repository.contexts[("user-a", "organization-a", "event-a")] = (
        cross_event_candidate
    )
    cross_department_repository = linked_repository()
    cross_department_repository.contexts[("user-a", "organization-a", "event-a")] = (
        organization_candidate(
            departments=(
                DepartmentRelationshipCandidate(
                    relationship_id="relationship-b",
                    user_id="user-a",
                    membership_id="membership-a",
                    organization_id="organization-b",
                    department_id="department-b",
                    is_active=True,
                ),
            )
        )
    )
    scope = RequestedOrganizationScope(
        organization_id="organization-a",
        event_id="event-a",
    )

    errors: list[ResourceNotFoundError] = []
    for repository in (
        missing_repository,
        cross_event_repository,
        cross_department_repository,
    ):
        with pytest.raises(ResourceNotFoundError) as error:
            IdentityContextResolver(repository).resolve(
                api_gateway_request_context(), scope
            )
        errors.append(error.value)

    assert {(error.http_status, error.code, str(error)) for error in errors} == {
        (404, "RESOURCE_NOT_FOUND", "요청한 정보를 찾을 수 없습니다.")
    }
    assert missing_repository.context_lookups == [
        ("user-a", "organization-a", "event-a")
    ]
    assert cross_event_repository.context_lookups == [
        ("user-a", "organization-a", "event-a")
    ]
    assert cross_department_repository.context_lookups == [
        ("user-a", "organization-a", "event-a")
    ]
