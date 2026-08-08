from __future__ import annotations

import pytest

from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    SoleOrganizationCandidate,
    SoleOrganizationContextResolver,
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
    """조직 화면의 맥락을 한 번의 조회로 답하는 최소 저장소.

    다른 조회를 쓰면 터진다. 신원·조직 판별·소속을 따로 읽던 때가 있었고 그때
    화면 하나를 여는 데 왕복이 넷이었다.
    """

    def __init__(self, *, candidate: SoleOrganizationCandidate | None = None) -> None:
        self._candidate = candidate
        self.lookups = 0

    def find_sole_organization_context(
        self, principal: CognitoPrincipal
    ) -> SoleOrganizationCandidate | None:
        assert principal.subject == "subject-a"
        self.lookups += 1
        return self._candidate

    def find_internal_user_id(self, *_: object, **__: object) -> None:
        raise AssertionError("신원을 따로 읽으면 왕복이 하나 더 든다.")

    def find_organization_context(self, **_: object) -> None:
        raise AssertionError("행사 조회를 쓰면 안 된다. 이 화면에는 행사가 없다.")


def _candidate(**overrides: object) -> SoleOrganizationCandidate:
    values: dict[str, object] = {
        "user_id": "user-a",
        "organization_id": "organization-a",
        "membership_id": "membership-a",
    }
    values.update(overrides)
    return SoleOrganizationCandidate(**values)  # pyright: ignore[reportArgumentType]


def test_an_active_member_resolves_without_an_event() -> None:
    # 조직 화면에는 행사가 없다. 행사를 요구하면 이 화면을 열 수 없다.
    repository = FakeRepository(candidate=_candidate())

    context = SoleOrganizationContextResolver(repository).resolve(REQUEST_CONTEXT)

    assert context.organization_id == "organization-a"
    assert context.membership_id == "membership-a"
    assert context.has_active_organization_membership


def test_the_whole_context_costs_one_lookup() -> None:
    # 화면이 열리는 시간이 여기서 정해진다. 조회 하나가 왕복 하나다.
    repository = FakeRepository(candidate=_candidate())

    SoleOrganizationContextResolver(repository).resolve(REQUEST_CONTEXT)

    assert repository.lookups == 1


def test_no_membership_is_not_found() -> None:
    # 비활성 소속도 여기로 온다. 저장소가 활성만 잇기 때문이다.
    repository = FakeRepository(
        candidate=_candidate(organization_id=None, membership_id=None)
    )

    with pytest.raises(ResourceNotFoundError):
        SoleOrganizationContextResolver(repository).resolve(REQUEST_CONTEXT)


def test_more_than_one_membership_is_not_found() -> None:
    # 어느 학생회를 말하는지 서버가 정할 수 없다. 아무거나 고르면 남의 명단이다.
    repository = FakeRepository(
        candidate=_candidate(organization_id=None, membership_id=None)
    )

    with pytest.raises(ResourceNotFoundError):
        SoleOrganizationContextResolver(repository).resolve(REQUEST_CONTEXT)


def test_a_blank_membership_is_not_found() -> None:
    repository = FakeRepository(candidate=_candidate(membership_id="  "))

    with pytest.raises(ResourceNotFoundError):
        SoleOrganizationContextResolver(repository).resolve(REQUEST_CONTEXT)


def test_an_unprovisioned_identity_stays_indistinguishable_from_auth_failure() -> None:
    # 외부에서 유효하지만 VADA에 등록되지 않은 신원이다. 소속 없음과는 다른 답이다.
    repository = FakeRepository(candidate=None)

    with pytest.raises(UnauthenticatedError):
        SoleOrganizationContextResolver(repository).resolve(REQUEST_CONTEXT)
