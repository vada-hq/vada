# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false
# ↑ 다른 API 테스트와 같은 한계다. starlette TestClient의 httpx 조건부 import로
#   반환 타입이 Unknown이 된다. 이 파일에만 적용한다.
from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from test_role_service import FakeStore, member_view, organization_context

from vada_api.main import create_app
from vada_api.organization.api import (
    get_member_role_service,
    get_organization_context,
)
from vada_api.organization.application import MemberRoleService
from vada_api.organization.roles import MemberRole

LIST_PATH = "/organization/member-roles"
CHANGE_PATH = "/organization/memberships/membership-a/role"


def build_client(store: FakeStore, membership_id: str) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_organization_context] = lambda: organization_context(
        membership_id
    )
    app.dependency_overrides[get_member_role_service] = lambda: MemberRoleService(store)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def store() -> FakeStore:
    return FakeStore(
        member_view("membership-president", MemberRole.PRESIDENT, "박해랑"),
        member_view("membership-a", MemberRole.MEMBER, "김도윤"),
    )


@pytest.fixture
def president(store: FakeStore) -> Iterator[TestClient]:
    yield from build_client(store, "membership-president")


@pytest.fixture
def member(store: FakeStore) -> Iterator[TestClient]:
    yield from build_client(store, "membership-a")


def _change(role: str = "department_head", expected: str = "member") -> dict[str, str]:
    return {"role": role, "expectedCurrentRole": expected}


def test_the_president_reads_the_member_roles(president: TestClient) -> None:
    body = president.get(LIST_PATH).json()

    assert [m["membershipId"] for m in body["members"]] == [
        "membership-president",
        "membership-a",
    ]
    assert body["members"][0]["displayName"] == "박해랑"


def test_a_member_cannot_read_the_roles(member: TestClient) -> None:
    response = member.get(LIST_PATH)

    assert response.status_code == 403
    assert response.headers["content-type"].startswith("application/problem+json")


def test_reads_never_leave_the_caller_organization(
    store: FakeStore, president: TestClient
) -> None:
    # 가짜 저장소에 다른 조직 구성원이 들어 있다. 범위를 빼먹으면 섞여 나온다.
    body = president.get(LIST_PATH).json()

    assert "membership-other" not in [m["membershipId"] for m in body["members"]]
    assert set(store.asked) == {"organization-a"}


def test_the_president_promotes_amember_view(
    store: FakeStore, president: TestClient
) -> None:
    response = president.put(CHANGE_PATH, json=_change())

    assert response.status_code == 200
    changed = next(
        m for m in response.json()["members"] if m["membershipId"] == "membership-a"
    )
    assert changed["role"] == "department_head"
    assert store.written == [
        ("membership-a", MemberRole.MEMBER, MemberRole.DEPARTMENT_HEAD)
    ]


def test_a_member_cannot_change_roles(store: FakeStore, member: TestClient) -> None:
    response = member.put(CHANGE_PATH, json=_change())

    assert response.status_code == 403
    assert store.written == []


def test_a_stale_expected_role_is_a_conflict(
    store: FakeStore, president: TestClient
) -> None:
    # 화면이 본 값이 낡았으면 덮어쓰지 않는다.
    response = president.put(CHANGE_PATH, json=_change(expected="president"))

    assert response.status_code == 409
    assert store.written == []


def test_the_last_president_cannot_step_down(president: TestClient) -> None:
    response = president.put(
        "/organization/memberships/membership-president/role",
        json=_change(role="member", expected="president"),
    )

    assert response.status_code == 409
    assert response.json()["code"] == "ORGANIZATION_LAST_PRESIDENT_PROTECTED"


def test_changing_to_the_same_role_is_rejected(president: TestClient) -> None:
    response = president.put(CHANGE_PATH, json=_change(role="member"))

    assert response.status_code == 422
    assert response.json()["code"] == "ORGANIZATION_ROLE_UNCHANGED"


def test_an_unknown_membership_is_not_found(president: TestClient) -> None:
    response = president.put(
        "/organization/memberships/membership-elsewhere/role", json=_change()
    )

    assert response.status_code == 404
