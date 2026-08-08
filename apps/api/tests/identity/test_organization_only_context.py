from __future__ import annotations

import pytest

from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    IdentityContextResolver,
    OrganizationOnlyContextCandidate,
)
from vada_api.identity.errors import ResourceNotFoundError, UnauthenticatedError

REQUEST_CONTEXT = {
    "authorizer": {
        "jwt": {
            "claims": {
                "iss": "https://cognito-idp.ap-northeast-2.amazonaws.com/pool-a",
                "sub": "subject-a",
                "token_use": "access",
            }
        }
    }
}


class FakeRepository:
    """행사 없이 조직만으로 맥락을 세우는 최소 저장소."""

    def __init__(
        self,
        *,
        user_id: str | None = "user-a",
        candidate: OrganizationOnlyContextCandidate | None = None,
    ) -> None:
        self._user_id = user_id
        self._candidate = candidate
        self.asked: list[tuple[str, str]] = []

    def find_internal_user_id(self, principal: CognitoPrincipal) -> str | None:
        assert principal.subject == "subject-a"
        return self._user_id

    def find_organization_context(self, **_: object) -> None:
        raise AssertionError("행사 조회를 쓰면 안 된다. 이 화면에는 행사가 없다.")

    def find_organization_only_context(
        self, *, user_id: str, organization_id: str
    ) -> OrganizationOnlyContextCandidate | None:
        self.asked.append((user_id, organization_id))
        return self._candidate


def _candidate(**overrides: object) -> OrganizationOnlyContextCandidate:
    values: dict[str, object] = {
        "user_id": "user-a",
        "organization_id": "organization-a",
        "membership_id": "membership-a",
        "membership_is_active": True,
    }
    values.update(overrides)
    return OrganizationOnlyContextCandidate(**values)  # pyright: ignore[reportArgumentType]


def test_an_active_member_resolves_without_an_event() -> None:
    # 조직 화면에는 행사가 없다. 행사를 요구하면 이 화면을 열 수 없다.
    repository = FakeRepository(candidate=_candidate())

    context = IdentityContextResolver(repository).resolve_organization(
        REQUEST_CONTEXT, organization_id="organization-a"
    )

    assert context.organization_id == "organization-a"
    assert context.membership_id == "membership-a"
    assert context.has_active_organization_membership
    assert repository.asked == [("user-a", "organization-a")]


def test_an_inactive_membership_is_not_a_trusted_context() -> None:
    repository = FakeRepository(candidate=_candidate(membership_is_active=False))

    with pytest.raises(ResourceNotFoundError):
        IdentityContextResolver(repository).resolve_organization(
            REQUEST_CONTEXT, organization_id="organization-a"
        )


def test_a_candidate_for_another_organization_is_rejected() -> None:
    # 저장소가 다른 조직 행을 돌려주더라도 요청한 조직과 다르면 믿지 않는다.
    repository = FakeRepository(candidate=_candidate(organization_id="organization-b"))

    with pytest.raises(ResourceNotFoundError):
        IdentityContextResolver(repository).resolve_organization(
            REQUEST_CONTEXT, organization_id="organization-a"
        )


def test_a_missing_membership_is_not_found() -> None:
    with pytest.raises(ResourceNotFoundError):
        IdentityContextResolver(FakeRepository()).resolve_organization(
            REQUEST_CONTEXT, organization_id="organization-a"
        )


def test_a_blank_organization_is_not_found() -> None:
    with pytest.raises(ResourceNotFoundError):
        IdentityContextResolver(FakeRepository()).resolve_organization(
            REQUEST_CONTEXT, organization_id="  "
        )


def test_an_unprovisioned_identity_stays_indistinguishable_from_auth_failure() -> None:
    repository = FakeRepository(user_id=None)

    with pytest.raises(UnauthenticatedError):
        IdentityContextResolver(repository).resolve_organization(
            REQUEST_CONTEXT, organization_id="organization-a"
        )
