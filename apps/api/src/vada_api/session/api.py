from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from vada_api.identity.context import TrustedOrganizationOnlyContext
from vada_api.organization.api import get_organization_context
from vada_api.session.application import SessionPersistenceError, SessionViewerService
from vada_api.session.authorization import SessionActionForbiddenError

router = APIRouter(tags=["Session"])

type ProblemHandler = Callable[[Request, Exception], JSONResponse]

# 계약과 구현을 잇는 다리다. `just api`가 이 ID로 구현 여부를 판정한다.
_OPERATION_METADATA: dict[str, object] = {
    "x-vada-permission": "session.read_self",
    "x-vada-contracts": [
        "API:session.get_viewer@R1",
        "AUTH:session.read_self@R1",
        "DATA:session.viewer@R1",
        "ERROR:http.unauthenticated@R1",
        "ERROR:http.resource_not_found@R1",
        "ERROR:purchase_request.persistence_unavailable@R1",
    ],
}


class ContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid", validate_by_alias=True, validate_by_name=False
    )


class CapabilitiesResponse(ContractModel):
    can_manage_finance: bool = Field(alias="canManageFinance")
    can_submit_purchase_request: bool = Field(alias="canSubmitPurchaseRequest")
    can_complete_event: bool = Field(alias="canCompleteEvent")
    can_edit_organization: bool = Field(alias="canEditOrganization")
    can_invite_organization_member: bool = Field(alias="canInviteOrganizationMember")
    can_manage_student_roster: bool = Field(alias="canManageStudentRoster")
    can_manage_student_fee_roster: bool = Field(alias="canManageStudentFeeRoster")


class SessionViewerResponse(ContractModel):
    user_id: str = Field(alias="userId", min_length=1)
    display_name: str = Field(alias="displayName", min_length=1)
    organization_id: str = Field(alias="organizationId", min_length=1)
    organization_name: str = Field(alias="organizationName", min_length=1)
    capabilities: CapabilitiesResponse


def get_session_viewer_service(request: Request) -> SessionViewerService:
    service: SessionViewerService = request.app.state.session_viewer_service
    return service


@router.get(
    "/session/viewer",
    operation_id="getSessionViewer",
    response_model=SessionViewerResponse,
    openapi_extra=_OPERATION_METADATA,
)
def get_session_viewer(
    context: Annotated[
        TrustedOrganizationOnlyContext, Depends(get_organization_context)
    ],
    service: Annotated[SessionViewerService, Depends(get_session_viewer_service)],
) -> dict[str, object]:
    viewer = service.read_viewer(context)
    capabilities = viewer.capabilities

    return {
        "userId": viewer.user_id,
        "displayName": viewer.display_name,
        "organizationId": viewer.organization_id,
        "organizationName": viewer.organization_name,
        "capabilities": {
            "canManageFinance": capabilities.can_manage_finance,
            "canSubmitPurchaseRequest": capabilities.can_submit_purchase_request,
            "canCompleteEvent": capabilities.can_complete_event,
            "canEditOrganization": capabilities.can_edit_organization,
            "canInviteOrganizationMember": capabilities.can_invite_organization_member,
            "canManageStudentRoster": capabilities.can_manage_student_roster,
            "canManageStudentFeeRoster": capabilities.can_manage_student_fee_roster,
        },
    }


def _forbidden(_request: Request, _error: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={
            "type": "https://vada.example/problems/session-action-forbidden",
            "title": "이 세션 동작을 수행할 권한이 없습니다.",
            "detail": "활성 소속이 있어야 자기 신원을 읽을 수 있습니다.",
            "status": 403,
            "code": "SESSION_ACTION_FORBIDDEN",
            "retryable": False,
        },
        media_type="application/problem+json",
    )


def _unavailable(_request: Request, _error: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "type": "https://vada.example/problems/session-persistence-unavailable",
            "title": "신원 정보를 일시적으로 처리할 수 없습니다.",
            "detail": "잠시 후 다시 시도해 주세요.",
            "status": 503,
            "code": "SESSION_PERSISTENCE_UNAVAILABLE",
            "retryable": True,
        },
        media_type="application/problem+json",
    )


def register_session_error_handlers(app: FastAPI) -> None:
    """계약 CB-IDENTITY-001@R1의 오류를 HTTP로 옮긴다."""

    handlers: list[tuple[type[Exception], ProblemHandler]] = [
        (SessionActionForbiddenError, _forbidden),
        (SessionPersistenceError, _unavailable),
    ]
    for error_type, handler in handlers:
        app.add_exception_handler(error_type, handler)
