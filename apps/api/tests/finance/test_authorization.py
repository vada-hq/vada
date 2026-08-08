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

# 조직의 활성 구성원이면 되는 두 읽기. 계약 CB-FIN-002@R1이 그렇게 정한다.
# 아래 행렬의 모든 배우가 자기 조직·행사 안에 있으므로 전부 이 둘을 갖는다.
EVENT_FINANCE_READS = (
    PurchaseRequestPermission.EVENT_BUDGET_READ,
    PurchaseRequestPermission.LIST_EVENT_ITEMS,
)
EVENT_FINANCE_READ_SET = frozenset(EVENT_FINANCE_READS)


@pytest.mark.parametrize(
    ("actor", "scope", "allowed"),
    [
        pytest.param(
            actor_facts(department_head_of=frozenset({"department-a"})),
            authorization_scope(),
            ALL_PERMISSIONS - {PurchaseRequestPermission.REVIEW},
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
            )
            | EVENT_FINANCE_READ_SET,
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
                    PurchaseRequestPermission.REVIEW,
                }
            )
            | EVENT_FINANCE_READ_SET,
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
            )
            | EVENT_FINANCE_READ_SET,
            id="general-member-owner",
        ),
        pytest.param(
            actor_facts(),
            authorization_scope(
                draft_owner_user_id="user-b",
                result_requester_user_id="user-b",
            ),
            frozenset({PurchaseRequestPermission.READ_DETAIL}) | EVENT_FINANCE_READ_SET,
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
            )
            | EVENT_FINANCE_READ_SET,
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
            )
            | EVENT_FINANCE_READ_SET,
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
def test_missing_trusted_actor_is_denied(
    permission: PurchaseRequestPermission,
) -> None:
    assert not is_purchase_request_action_allowed(
        permission,
        actor=None,
        scope=authorization_scope(),
    )


@pytest.mark.parametrize(
    "permission",
    [
        permission
        for permission in PurchaseRequestPermission
        if permission not in EVENT_FINANCE_READ_SET
    ],
)
def test_missing_required_resource_facts_are_denied(
    permission: PurchaseRequestPermission,
) -> None:
    # 행사 재정 읽기 둘은 여기서 뺀다. 그 둘이 요구하는 자원 사실은 행사가 속한
    # 조직뿐이라 이 스코프가 이미 완전하다. 요청 단위 동작만 요청 사실을 더 본다.
    incomplete_scope = PurchaseRequestAuthorizationScope(
        event_id="event-a",
        event_organization_id="organization-a",
    )

    assert not is_purchase_request_action_allowed(
        permission,
        actor=actor_facts(),
        scope=incomplete_scope,
    )


def test_permission_catalog_uses_the_approved_action_keys() -> None:
    assert {permission.value for permission in PurchaseRequestPermission} == {
        "purchase_request.draft.read",
        "purchase_request.draft.write",
        "purchase_request.draft.delete",
        "purchase_request.submit",
        "purchase_request.list_own",
        "purchase_request.read_detail",
        "purchase_request.review",
        "purchase_request.resubmit_revision",
        "event_budget.read",
        "purchase_request.list_event_items",
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


def test_only_finance_members_may_review_not_department_heads() -> None:
    # 부서장은 자기 부서 요청을 만들 수 있지만 검토 결정은 할 수 없다.
    # VADA_PERMISSION_MATRIX.md가 검토·승인을 canManageFinance로 묶는다.
    department_head = actor_facts(department_head_of=frozenset({"department-a"}))
    finance = actor_facts(finance_member_of=frozenset({"organization-a"}))
    scope = authorization_scope(request_department_id="department-a")

    assert not is_purchase_request_action_allowed(
        PurchaseRequestPermission.REVIEW, actor=department_head, scope=scope
    )
    assert is_purchase_request_action_allowed(
        PurchaseRequestPermission.REVIEW, actor=finance, scope=scope
    )

    # 요청을 만드는 권한은 부서장에게 그대로 있다. 검토만 막힌다.
    assert is_purchase_request_action_allowed(
        PurchaseRequestPermission.SUBMIT, actor=department_head, scope=scope
    )


@pytest.mark.parametrize("permission", EVENT_FINANCE_READS)
def test_event_finance_reads_allow_any_active_member(
    permission: PurchaseRequestPermission,
) -> None:
    # 계약 AUTH:event_budget.read@R1과 list_event_items@R1은 조직의 활성 구성원이면
    # 된다고 적는다. 재정부도 부서장도 아닌 부원이 행사 재정 화면을 열 수 있어야 한다.
    member = actor_facts()
    scope = authorization_scope(request_department_id=None)

    assert is_purchase_request_action_allowed(permission, actor=member, scope=scope)


@pytest.mark.parametrize("permission", EVENT_FINANCE_READS)
def test_event_finance_reads_do_not_require_a_department_fact(
    permission: PurchaseRequestPermission,
) -> None:
    # 부서에 배정되지 않은 구성원도 활성 구성원이다. 계약이 요구하지 않는 조건을
    # 더 붙이면 그 사람은 행사 재정을 못 본다.
    unassigned = PurchaseRequestActorFacts(
        identity=TrustedOrganizationContext(
            principal=CognitoPrincipal(
                issuer="https://cognito-idp.ap-northeast-2.amazonaws.com/pool-a",
                subject="subject-user-a",
            ),
            user_id="user-a",
            organization_id="organization-a",
            membership_id="membership-user-a",
            event_id="event-a",
            department_relationships=(),
        )
    )

    assert is_purchase_request_action_allowed(
        permission, actor=unassigned, scope=authorization_scope()
    )


@pytest.mark.parametrize("permission", EVENT_FINANCE_READS)
def test_event_finance_reads_deny_other_organizations_and_events(
    permission: PurchaseRequestPermission,
) -> None:
    outsider = actor_facts(organization_id="organization-b")
    other_event = actor_facts(event_id="event-b")

    assert not is_purchase_request_action_allowed(
        permission, actor=outsider, scope=authorization_scope()
    )
    assert not is_purchase_request_action_allowed(
        permission, actor=other_event, scope=authorization_scope()
    )
    assert not is_purchase_request_action_allowed(
        permission, actor=None, scope=authorization_scope()
    )
