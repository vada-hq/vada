from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Literal, Protocol

from fastapi import APIRouter, Depends, FastAPI, Path, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from vada_api.identity.context import TrustedOrganizationOnlyContext
from vada_api.organization.application import (
    MemberRoleService,
    MemberRoleView,
    OrganizationPersistenceError,
    RoleChangeRaceError,
)
from vada_api.organization.authorization import OrganizationActionForbiddenError
from vada_api.organization.roles import (
    LastPresidentProtectedError,
    MemberRole,
    RoleChangeCommand,
    RoleChangeConflictError,
    RoleUnchangedError,
)

router = APIRouter(tags=["Organization"])


class OrganizationContextProvider(Protocol):
    """Cognito와 조직 관계를 서버에서 해석하는 배포 어댑터 포트."""

    def resolve(self, request: Request) -> TrustedOrganizationOnlyContext: ...


class ContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid", validate_by_alias=True, validate_by_name=False
    )


class MemberRoleResponse(ContractModel):
    membership_id: str = Field(alias="membershipId", min_length=1)
    display_name: str = Field(alias="displayName", min_length=1)
    departments: list[str]
    role: Literal["president", "department_head", "member"]


class MemberRolesResponse(ContractModel):
    members: list[MemberRoleResponse]


class RoleChangeCommandModel(ContractModel):
    role: Literal["president", "department_head", "member"]
    # 화면이 본 현재 역할. 그 사이 바뀌었으면 덮어쓰지 않는다.
    expected_current_role: Literal["president", "department_head", "member"] = Field(
        alias="expectedCurrentRole"
    )


def get_organization_context(request: Request) -> TrustedOrganizationOnlyContext:
    provider: OrganizationContextProvider = (
        request.app.state.organization_context_provider
    )
    return provider.resolve(request)


def get_member_role_service(request: Request) -> MemberRoleService:
    service: MemberRoleService = request.app.state.member_role_service
    return service


def _members_json(members: tuple[MemberRoleView, ...]) -> dict[str, object]:
    return {
        "members": [
            {
                "membershipId": member.membership_id,
                "displayName": member.display_name,
                "departments": list(member.departments),
                "role": member.role.value,
            }
            for member in members
        ]
    }


@router.get(
    "/organization/member-roles",
    operation_id="listOrganizationMemberRoles",
    response_model=MemberRolesResponse,
)
def list_member_roles(
    context: Annotated[
        TrustedOrganizationOnlyContext, Depends(get_organization_context)
    ],
    service: Annotated[MemberRoleService, Depends(get_member_role_service)],
) -> dict[str, object]:
    return _members_json(service.list_member_roles(context))


@router.put(
    "/organization/memberships/{membershipId}/role",
    operation_id="changeOrganizationMemberRole",
    response_model=MemberRolesResponse,
)
def change_member_role(
    command: RoleChangeCommandModel,
    membership_id: Annotated[str, Path(alias="membershipId", min_length=1)],
    context: Annotated[
        TrustedOrganizationOnlyContext, Depends(get_organization_context)
    ],
    service: Annotated[MemberRoleService, Depends(get_member_role_service)],
) -> dict[str, object]:
    return _members_json(
        service.change_member_role(
            context,
            membership_id=membership_id,
            command=RoleChangeCommand(
                membership_id=membership_id,
                role=MemberRole(command.role),
                expected_current_role=MemberRole(command.expected_current_role),
            ),
        )
    )


class _Problem:
    """계약이 정한 오류 하나. RFC 9457 problem+json으로 낸다."""

    def __init__(
        self,
        *,
        status: int,
        problem_type: str,
        title: str,
        detail: str,
        code: str,
        retryable: bool,
    ) -> None:
        self.status = status
        self.body: dict[str, object] = {
            "type": problem_type,
            "title": title,
            "detail": detail,
            "status": status,
            "code": code,
            "retryable": retryable,
        }

    def handler(self) -> Callable[[Request, Exception], JSONResponse]:
        def handle(_request: Request, _error: Exception) -> JSONResponse:
            return JSONResponse(
                status_code=self.status,
                content=self.body,
                media_type="application/problem+json",
            )

        return handle


def register_organization_error_handlers(app: FastAPI) -> None:
    """계약 CB-ORG-001@R1의 오류를 HTTP로 옮긴다."""

    mapping: list[tuple[type[Exception], _Problem]] = [
        (
            OrganizationActionForbiddenError,
            _Problem(
                status=403,
                problem_type="https://vada.example/problems/organization-action-forbidden",
                title="이 조직 동작을 수행할 권한이 없습니다.",
                detail="기본 역할 변경은 회장단만 할 수 있습니다.",
                code="ORGANIZATION_ACTION_FORBIDDEN",
                retryable=False,
            ),
        ),
        (
            RoleUnchangedError,
            _Problem(
                status=422,
                problem_type="https://vada.example/problems/organization-role-unchanged",
                title="바꿀 것이 없습니다.",
                detail="이미 그 역할입니다.",
                code="ORGANIZATION_ROLE_UNCHANGED",
                retryable=False,
            ),
        ),
        (
            LastPresidentProtectedError,
            _Problem(
                status=409,
                problem_type="https://vada.example/problems/organization-last-president-protected",
                title="마지막 회장단은 바꿀 수 없습니다.",
                detail="먼저 다른 구성원에게 회장단을 부여하세요.",
                code="ORGANIZATION_LAST_PRESIDENT_PROTECTED",
                retryable=False,
            ),
        ),
        # 화면이 본 값이 낡았다는 사실은 하나다. 판정에서 걸리든 쓰기에서
        # 걸리든 요청자에게 필요한 답은 "다시 읽으라"로 같다.
        *[
            (
                error_type,
                _Problem(
                    status=409,
                    problem_type="https://vada.example/problems/organization-state-conflict",
                    title="그 사이 역할이 바뀌었습니다.",
                    detail="최신 상태를 다시 조회한 뒤 시도해 주세요.",
                    code="ORGANIZATION_STATE_CONFLICT",
                    retryable=True,
                ),
            )
            for error_type in (RoleChangeConflictError, RoleChangeRaceError)
        ],
        (
            OrganizationPersistenceError,
            _Problem(
                status=503,
                problem_type="https://vada.example/problems/organization-persistence-unavailable",
                title="조직 정보를 일시적으로 처리할 수 없습니다.",
                detail="잠시 후 다시 시도해 주세요.",
                code="ORGANIZATION_PERSISTENCE_UNAVAILABLE",
                retryable=True,
            ),
        ),
    ]
    for error_type, problem in mapping:
        app.add_exception_handler(error_type, problem.handler())
