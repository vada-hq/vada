import pytest

from vada_api.finance.authorization import (
    PurchaseRequestActionForbiddenError,
    PurchaseRequestActorFacts,
    PurchaseRequestAuthorizationScope,
    PurchaseRequestPermission,
    is_purchase_request_action_allowed,
    require_purchase_request_permission,
)
from vada_api.identity import (
    CognitoPrincipal,
    DepartmentRelationshipFact,
    TrustedOrganizationContext,
)


def trusted_context(
    *,
    user_id: str = "user-a",
    organization_id: str = "organization-a",
    event_id: str = "event-a",
    department_id: str = "department-a",
) -> TrustedOrganizationContext:
    return TrustedOrganizationContext(
        principal=CognitoPrincipal(
            issuer="https://cognito-idp.ap-northeast-2.amazonaws.com/pool-a",
            subject=f"subject-{user_id}",
        ),
        user_id=user_id,
        organization_id=organization_id,
        membership_id=f"membership-{user_id}",
        event_id=event_id,
        department_relationships=(
            DepartmentRelationshipFact(
                relationship_id=f"department-relationship-{user_id}",
                department_id=department_id,
            ),
        ),
    )


def actor_facts(
    *,
    user_id: str = "user-a",
    organization_id: str = "organization-a",
    event_id: str = "event-a",
    department_id: str = "department-a",
    department_head_of: frozenset[str] = frozenset(),
    finance_member_of: frozenset[str] = frozenset(),
) -> PurchaseRequestActorFacts:
    return PurchaseRequestActorFacts(
        identity=trusted_context(
            user_id=user_id,
            organization_id=organization_id,
            event_id=event_id,
            department_id=department_id,
        ),
        department_head_of=department_head_of,
        finance_member_of=finance_member_of,
    )


def authorization_scope(
    *,
    draft_owner_user_id: str = "user-a",
    result_requester_user_id: str = "user-a",
    event_id: str = "event-a",
    event_organization_id: str = "organization-a",
    request_department_id: str | None = "department-a",
    request_organization_id: str = "organization-a",
    request_event_id: str = "event-a",
) -> PurchaseRequestAuthorizationScope:
    return PurchaseRequestAuthorizationScope(
        event_id=event_id,
        event_organization_id=event_organization_id,
        request_department_id=request_department_id,
        draft_owner_user_id=draft_owner_user_id,
        result_requester_user_id=result_requester_user_id,
        request_organization_id=request_organization_id,
        request_event_id=request_event_id,
    )


ALL_PERMISSIONS = frozenset(PurchaseRequestPermission)


@pytest.mark.parametrize(
    ("actor", "scope", "allowed"),
    [
        pytest.param(
            actor_facts(department_head_of=frozenset({"department-a"})),
            authorization_scope(),
            ALL_PERMISSIONS,
            id="department-head-owner",
        ),
        pytest.param(
            actor_facts(department_head_of=frozenset({"department-a"})),
            authorization_scope(
                draft_owner_user_id="user-b",
                result_requester_user_id="user-b",
            ),
            frozenset(
                {
                    PurchaseRequestPermission.SUBMIT,
                    PurchaseRequestPermission.READ_DETAIL,
                }
            ),
            id="department-head-non-owner",
        ),
        pytest.param(
            actor_facts(finance_member_of=frozenset({"organization-a"})),
            authorization_scope(),
            ALL_PERMISSIONS,
            id="finance-member-owner",
        ),
        pytest.param(
            actor_facts(finance_member_of=frozenset({"organization-a"})),
            authorization_scope(
                draft_owner_user_id="user-b",
                result_requester_user_id="user-b",
            ),
            frozenset(
                {
                    PurchaseRequestPermission.SUBMIT,
                    PurchaseRequestPermission.READ_DETAIL,
                }
            ),
            id="finance-member-non-owner",
        ),
        pytest.param(
            actor_facts(),
            authorization_scope(),
            frozenset(
                {
                    PurchaseRequestPermission.DRAFT_DELETE,
                    PurchaseRequestPermission.READ_DETAIL,
                }
            ),
            id="general-member-owner",
        ),
        pytest.param(
            actor_facts(),
            authorization_scope(
                draft_owner_user_id="user-b",
                result_requester_user_id="user-b",
            ),
            frozenset({PurchaseRequestPermission.READ_DETAIL}),
            id="general-member-non-owner",
        ),
        pytest.param(
            actor_facts(department_head_of=frozenset({"department-b"})),
            authorization_scope(),
            frozenset(
                {
                    PurchaseRequestPermission.DRAFT_DELETE,
                    PurchaseRequestPermission.READ_DETAIL,
                }
            ),
            id="other-department-head-owner",
        ),
        pytest.param(
            actor_facts(finance_member_of=frozenset({"organization-b"})),
            authorization_scope(),
            frozenset(
                {
                    PurchaseRequestPermission.DRAFT_DELETE,
                    PurchaseRequestPermission.READ_DETAIL,
                }
            ),
            id="other-organization-finance-owner",
        ),
    ],
)
def test_permission_matrix_defaults_every_unlisted_combination_to_deny(
    actor: PurchaseRequestActorFacts,
    scope: PurchaseRequestAuthorizationScope,
    allowed: frozenset[PurchaseRequestPermission],
) -> None:
    decisions = {
        permission: is_purchase_request_action_allowed(
            permission,
            actor=actor,
            scope=scope,
        )
        for permission in PurchaseRequestPermission
    }

    assert {
        permission for permission, decision in decisions.items() if decision
    } == allowed


def test_only_draft_owner_match_grants_draft_actions_not_own_list() -> None:
    actor = actor_facts(department_head_of=frozenset({"department-a"}))
    scope = authorization_scope(
        draft_owner_user_id="user-a",
        result_requester_user_id="user-b",
    )

    assert is_purchase_request_action_allowed(
        PurchaseRequestPermission.DRAFT_READ,
        actor=actor,
        scope=scope,
    )
    assert is_purchase_request_action_allowed(
        PurchaseRequestPermission.DRAFT_WRITE,
        actor=actor,
        scope=scope,
    )
    assert is_purchase_request_action_allowed(
        PurchaseRequestPermission.DRAFT_DELETE,
        actor=actor,
        scope=scope,
    )
    assert not is_purchase_request_action_allowed(
        PurchaseRequestPermission.LIST_OWN,
        actor=actor,
        scope=scope,
    )


def test_only_result_requester_match_grants_own_list_not_draft_actions() -> None:
    actor = actor_facts(department_head_of=frozenset({"department-a"}))
    scope = authorization_scope(
        draft_owner_user_id="user-b",
        result_requester_user_id="user-a",
    )

    assert not is_purchase_request_action_allowed(
        PurchaseRequestPermission.DRAFT_READ,
        actor=actor,
        scope=scope,
    )
    assert not is_purchase_request_action_allowed(
        PurchaseRequestPermission.DRAFT_WRITE,
        actor=actor,
        scope=scope,
    )
    assert not is_purchase_request_action_allowed(
        PurchaseRequestPermission.DRAFT_DELETE,
        actor=actor,
        scope=scope,
    )
    assert is_purchase_request_action_allowed(
        PurchaseRequestPermission.LIST_OWN,
        actor=actor,
        scope=scope,
    )


@pytest.mark.parametrize(
    "permission",
    [
        PurchaseRequestPermission.DRAFT_READ,
        PurchaseRequestPermission.DRAFT_WRITE,
        PurchaseRequestPermission.SUBMIT,
        PurchaseRequestPermission.LIST_OWN,
    ],
)
def test_finance_relationship_does_not_require_a_department_fact(
    permission: PurchaseRequestPermission,
) -> None:
    assert is_purchase_request_action_allowed(
        permission,
        actor=actor_facts(finance_member_of=frozenset({"organization-a"})),
        scope=authorization_scope(request_department_id=None),
    )


@pytest.mark.parametrize(
    "permission",
    [
        PurchaseRequestPermission.DRAFT_READ,
        PurchaseRequestPermission.DRAFT_WRITE,
        PurchaseRequestPermission.SUBMIT,
        PurchaseRequestPermission.LIST_OWN,
    ],
)
def test_department_head_relationship_must_be_in_the_trusted_department_context(
    permission: PurchaseRequestPermission,
) -> None:
    assert not is_purchase_request_action_allowed(
        permission,
        actor=actor_facts(
            department_id="department-b",
            department_head_of=frozenset({"department-a"}),
        ),
        scope=authorization_scope(request_department_id="department-a"),
    )


@pytest.mark.parametrize("permission", list(PurchaseRequestPermission))
def test_cross_organization_and_cross_event_combinations_are_denied(
    permission: PurchaseRequestPermission,
) -> None:
    current_actor = actor_facts(
        department_head_of=frozenset({"department-a"}),
        finance_member_of=frozenset({"organization-a"}),
    )
    other_organization_actor = actor_facts(
        user_id="user-b",
        organization_id="organization-b",
        event_id="event-b",
        department_head_of=frozenset({"department-a"}),
        finance_member_of=frozenset({"organization-a"}),
    )

    assert not is_purchase_request_action_allowed(
        permission,
        actor=current_actor,
        scope=authorization_scope(event_organization_id="organization-b"),
    )
    assert not is_purchase_request_action_allowed(
        permission,
        actor=current_actor,
        scope=authorization_scope(event_id="event-b", request_event_id="event-b"),
    )
    assert not is_purchase_request_action_allowed(
        permission,
        actor=other_organization_actor,
        scope=authorization_scope(
            draft_owner_user_id="user-b",
            result_requester_user_id="user-b",
        ),
    )


def test_detail_read_denies_cross_organization_and_route_event_resources() -> None:
    actor = actor_facts()

    assert not is_purchase_request_action_allowed(
        PurchaseRequestPermission.READ_DETAIL,
        actor=actor,
        scope=authorization_scope(request_organization_id="organization-b"),
    )
    assert not is_purchase_request_action_allowed(
        PurchaseRequestPermission.READ_DETAIL,
        actor=actor,
        scope=authorization_scope(request_event_id="event-b"),
    )


@pytest.mark.parametrize("permission", list(PurchaseRequestPermission))
def test_missing_trusted_actor_or_required_resource_facts_are_denied(
    permission: PurchaseRequestPermission,
) -> None:
    actor = actor_facts()
    incomplete_scope = PurchaseRequestAuthorizationScope(
        event_id="event-a",
        event_organization_id="organization-a",
    )

    assert not is_purchase_request_action_allowed(
        permission,
        actor=None,
        scope=authorization_scope(),
    )
    assert not is_purchase_request_action_allowed(
        permission,
        actor=actor,
        scope=incomplete_scope,
    )


def test_permission_catalog_uses_the_six_approved_action_keys() -> None:
    assert {permission.value for permission in PurchaseRequestPermission} == {
        "purchase_request.draft.read",
        "purchase_request.draft.write",
        "purchase_request.draft.delete",
        "purchase_request.submit",
        "purchase_request.list_own",
        "purchase_request.read_detail",
    }


def test_unknown_permission_key_fails_closed() -> None:
    assert not is_purchase_request_action_allowed(
        "purchase_request.unknown",
        actor=actor_facts(
            department_head_of=frozenset({"department-a"}),
            finance_member_of=frozenset({"organization-a"}),
        ),
        scope=authorization_scope(),
    )


def test_require_permission_raises_the_approved_non_disclosing_error() -> None:
    with pytest.raises(PurchaseRequestActionForbiddenError) as error:
        require_purchase_request_permission(
            PurchaseRequestPermission.SUBMIT,
            actor=actor_facts(),
            scope=authorization_scope(),
        )

    assert error.value.http_status == 403
    assert error.value.code == "PURCHASE_REQUEST_ACTION_FORBIDDEN"
    assert error.value.problem_type == (
        "https://vada.example/problems/purchase-request-action-forbidden"
    )
    assert str(error.value) == "이 구매 요청 동작을 수행할 권한이 없습니다."
    assert "department" not in str(error.value).lower()
    assert "finance" not in str(error.value).lower()
