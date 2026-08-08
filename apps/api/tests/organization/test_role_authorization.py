from __future__ import annotations

import pytest

from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import TrustedOrganizationOnlyContext
from vada_api.organization.authorization import (
    OrganizationActionForbiddenError,
    OrganizationPermission,
    is_organization_action_allowed,
    require_organization_permission,
)
from vada_api.organization.roles import MemberRole

MANAGE = OrganizationPermission.MANAGE_MEMBER_ROLES


def _context() -> TrustedOrganizationOnlyContext:
    return TrustedOrganizationOnlyContext(
        principal=CognitoPrincipal(
            issuer="https://cognito-idp.ap-northeast-2.amazonaws.com/pool-a",
            subject="subject-a",
        ),
        user_id="user-a",
        organization_id="organization-a",
        membership_id="membership-a",
    )


def test_only_the_president_may_change_base_roles() -> None:
    assert is_organization_action_allowed(
        MANAGE, context=_context(), actor_role=MemberRole.PRESIDENT
    )


@pytest.mark.parametrize("role", [MemberRole.DEPARTMENT_HEAD, MemberRole.MEMBER])
def test_department_heads_and_members_may_not(role: MemberRole) -> None:
    # 부서장은 자기 부서를 운영하지만 남의 직급을 바꾸지는 못한다.
    assert not is_organization_action_allowed(
        MANAGE, context=_context(), actor_role=role
    )


def test_missing_facts_fail_closed() -> None:
    assert not is_organization_action_allowed(
        MANAGE, context=None, actor_role=MemberRole.PRESIDENT
    )
    assert not is_organization_action_allowed(
        MANAGE, context=_context(), actor_role=None
    )


def test_an_unknown_permission_key_fails_closed() -> None:
    # 오타가 권한 우회가 되면 안 된다.
    assert not is_organization_action_allowed(
        "organization.manage_member_role",
        context=_context(),
        actor_role=MemberRole.PRESIDENT,
    )


def test_the_catalog_uses_the_approved_action_keys() -> None:
    assert {permission.value for permission in OrganizationPermission} == {
        "organization.manage_member_roles",
    }


def test_the_refusal_does_not_say_which_relationship_is_missing() -> None:
    with pytest.raises(OrganizationActionForbiddenError) as error:
        require_organization_permission(
            MANAGE, context=_context(), actor_role=MemberRole.MEMBER
        )

    message = str(error.value)
    assert "회장단" not in message
    assert "president" not in message.lower()
