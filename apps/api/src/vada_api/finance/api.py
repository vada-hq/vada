from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Protocol

from fastapi import APIRouter, Depends, FastAPI, Header, Path, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

from vada_api.finance.application import (
    FinanceRequestContext,
    PurchaseRequestDraft,
    PurchaseRequestService,
    PurchaseRequestSummary,
)
from vada_api.finance.authorization import (
    PurchaseRequestActionForbiddenError,
    PurchaseRequestPermission,
)
from vada_api.finance.submission import (
    DraftReference,
    PurchaseRequestContent,
    PurchaseRequestItemInput,
    PurchaseRequestPersistenceError,
    PurchaseRequestRecord,
    PurchaseRequestStateConflictError,
)
from vada_api.identity.errors import ResourceNotFoundError, UnauthenticatedError

router = APIRouter(tags=["Purchase Requests"])


class PurchaseRequestContextProvider(Protocol):
    """Cognito 및 내부 조직 관계를 서버에서 해석하는 배포 어댑터 포트."""

    def resolve(self, request: Request, *, event_id: str) -> FinanceRequestContext: ...


class ContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid", validate_by_alias=True, validate_by_name=False
    )


class DraftEvidenceModel(ContractModel):
    type: (
        Literal["product_url", "vendor", "price_screenshot", "vendor_quote"] | None
    ) = None
    url: str = ""
    vendor_name: str = Field(default="", alias="vendorName")
    file_ref: str = Field(default="", alias="fileRef")
    note: str = ""


class DraftDetailsModel(ContractModel):
    vendor: str = ""
    product_url: str = Field(default="", alias="productUrl")
    options: str = ""
    delivery_request: str = Field(default="", alias="deliveryRequest")
    item_kind: str = Field(default="", alias="itemKind")
    specification: str = ""
    color: str = ""
    option_quantities: dict[str, Decimal | None] = Field(
        default_factory=dict, alias="optionQuantities"
    )
    print_method: str = Field(default="", alias="printMethod")
    delivery_date: str = Field(default="", alias="deliveryDate")
    file_refs: list[str] = Field(default_factory=list, alias="fileRefs")
    request_note: str = Field(default="", alias="requestNote")
    pickup_location: str = Field(default="", alias="pickupLocation")
    start_date: str = Field(default="", alias="startDate")
    end_date: str = Field(default="", alias="endDate")
    contact: str = ""
    deposit_amount: int | None = Field(default=None, alias="depositAmount")
    conditions: str = ""
    provider: str = ""
    location: str = ""
    scope: str = ""


class DraftItemModel(ContractModel):
    name: str = ""
    category: str = ""
    budget_item: str = Field(default="", alias="budgetItem")
    purchase_type: (
        Literal["general", "manufacturing_printing", "rental", "service"] | None
    ) = Field(default=None, alias="purchaseType")
    quantity: Decimal | None = None
    unit: str = ""
    estimated_unit_price: int | None = Field(default=None, alias="estimatedUnitPrice")
    price_evidence: list[DraftEvidenceModel] = Field(
        default_factory=lambda: list[DraftEvidenceModel](), alias="priceEvidence"
    )
    details: DraftDetailsModel = Field(default_factory=DraftDetailsModel)


class DraftContentModel(ContractModel):
    title: str = ""
    needed_date: str = Field(default="", alias="neededDate")
    purpose: str = ""
    priority: Literal["normal", "urgent"] | None = None
    items: list[DraftItemModel] = Field(default_factory=lambda: list[DraftItemModel]())


class DraftSaveCommandModel(ContractModel):
    expected_version: int | None = Field(alias="expectedVersion", ge=1)
    content: DraftContentModel


class ProductUrlEvidenceModel(ContractModel):
    type: Literal["product_url"]
    url: str = Field(min_length=1)


class VendorEvidenceModel(ContractModel):
    type: Literal["vendor"]
    vendor_name: str = Field(alias="vendorName", min_length=1)


class PriceScreenshotEvidenceModel(ContractModel):
    type: Literal["price_screenshot"]
    file_ref: str = Field(alias="fileRef", min_length=1)


class VendorQuoteEvidenceModel(ContractModel):
    type: Literal["vendor_quote"]
    file_ref: str | None = Field(default=None, alias="fileRef", min_length=1)
    note: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def require_file_or_note(self) -> VendorQuoteEvidenceModel:
        if self.file_ref is None and self.note is None:
            raise ValueError("fileRef 또는 note 중 하나가 필요합니다.")
        return self


type PriceEvidenceModel = Annotated[
    ProductUrlEvidenceModel
    | VendorEvidenceModel
    | PriceScreenshotEvidenceModel
    | VendorQuoteEvidenceModel,
    Field(discriminator="type"),
]


class GeneralDetailsModel(ContractModel):
    vendor: str | None = Field(default=None, min_length=1)
    product_url: str | None = Field(default=None, alias="productUrl", min_length=1)
    options: str | None = Field(default=None, min_length=1)
    delivery_request: str | None = Field(
        default=None, alias="deliveryRequest", min_length=1
    )


class ManufacturingPrintingDetailsModel(ContractModel):
    item_kind: str | None = Field(default=None, alias="itemKind", min_length=1)
    specification: str | None = Field(default=None, min_length=1)
    color: str | None = Field(default=None, min_length=1)
    option_quantities: dict[str, Annotated[Decimal, Field(gt=0)]] | None = Field(
        default=None, alias="optionQuantities", min_length=1
    )
    print_method: str | None = Field(default=None, alias="printMethod", min_length=1)
    delivery_date: date | None = Field(default=None, alias="deliveryDate")
    file_refs: list[Annotated[str, Field(min_length=1)]] | None = Field(
        default=None, alias="fileRefs"
    )
    request_note: str | None = Field(default=None, alias="requestNote", min_length=1)


class RentalDetailsModel(ContractModel):
    vendor: str | None = Field(default=None, min_length=1)
    pickup_location: str | None = Field(
        default=None, alias="pickupLocation", min_length=1
    )
    start_date: date | None = Field(default=None, alias="startDate")
    end_date: date | None = Field(default=None, alias="endDate")
    contact: str | None = Field(default=None, min_length=1)
    deposit_amount: int | None = Field(default=None, alias="depositAmount", ge=0)
    conditions: str | None = Field(default=None, min_length=1)


class ServiceDetailsModel(ContractModel):
    provider: str | None = Field(default=None, min_length=1)
    location: str | None = Field(default=None, min_length=1)
    start_date: date | None = Field(default=None, alias="startDate")
    end_date: date | None = Field(default=None, alias="endDate")
    contact: str | None = Field(default=None, min_length=1)
    scope: str | None = Field(default=None, min_length=1)
    request_note: str | None = Field(default=None, alias="requestNote", min_length=1)


_DETAIL_ADAPTERS: Mapping[str, TypeAdapter[BaseModel]] = {
    "general": TypeAdapter(GeneralDetailsModel),
    "manufacturing_printing": TypeAdapter(ManufacturingPrintingDetailsModel),
    "rental": TypeAdapter(RentalDetailsModel),
    "service": TypeAdapter(ServiceDetailsModel),
}


class PurchaseRequestItemModel(ContractModel):
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    budget_item: str = Field(alias="budgetItem", min_length=1)
    purchase_type: Literal["general", "manufacturing_printing", "rental", "service"] = (
        Field(alias="purchaseType")
    )
    quantity: Decimal = Field(gt=0)
    unit: str = Field(min_length=1)
    estimated_unit_price: int = Field(alias="estimatedUnitPrice", gt=0)
    price_evidence: list[PriceEvidenceModel] = Field(
        alias="priceEvidence", min_length=1
    )
    details: dict[str, object]

    @model_validator(mode="after")
    def validate_type_specific_contract(self) -> PurchaseRequestItemModel:
        evidence_types = {evidence.type for evidence in self.price_evidence}
        required = (
            {"product_url", "vendor", "price_screenshot"}
            if self.purchase_type == "general"
            else {"vendor_quote"}
        )
        if not evidence_types.intersection(required):
            raise ValueError("구매 유형에 맞는 가격 근거가 필요합니다.")
        adapter = _DETAIL_ADAPTERS[self.purchase_type]
        validated = adapter.validate_python(self.details)
        self.details = validated.model_dump(
            by_alias=True, exclude_none=True, mode="json"
        )
        return self


class PurchaseRequestInputModel(ContractModel):
    title: str = Field(min_length=1)
    needed_date: date = Field(alias="neededDate")
    purpose: str = Field(min_length=1)
    priority: Literal["normal", "urgent"]
    items: list[PurchaseRequestItemModel] = Field(min_length=1)


class DraftReferenceModel(ContractModel):
    draft_id: str = Field(alias="draftId", min_length=1)
    version: int = Field(ge=1)


class PurchaseRequestSubmitCommandModel(ContractModel):
    content: PurchaseRequestInputModel
    draft_ref: DraftReferenceModel | None = Field(default=None, alias="draftRef")


class AuthorizedPurchaseRequest:
    def __init__(
        self, service: PurchaseRequestService, context: FinanceRequestContext
    ) -> None:
        self.service = service
        self.context = context


EventId = Annotated[str, Path(alias="eventId", min_length=1)]


def get_purchase_request_context(
    request: Request, event_id: EventId
) -> FinanceRequestContext:
    provider: PurchaseRequestContextProvider | None = getattr(
        request.app.state, "purchase_request_context_provider", None
    )
    if provider is None:
        raise UnauthenticatedError
    return provider.resolve(request, event_id=event_id)


def get_purchase_request_service(request: Request) -> PurchaseRequestService:
    service: PurchaseRequestService | None = getattr(
        request.app.state, "purchase_request_service", None
    )
    if service is None:
        raise PurchaseRequestPersistenceError
    return service


def require_permission(
    permission: PurchaseRequestPermission,
) -> Callable[..., AuthorizedPurchaseRequest]:
    def dependency(
        context: Annotated[
            FinanceRequestContext, Depends(get_purchase_request_context)
        ],
        service: Annotated[
            PurchaseRequestService, Depends(get_purchase_request_service)
        ],
    ) -> AuthorizedPurchaseRequest:
        service.require_permission(permission, context)
        return AuthorizedPurchaseRequest(service, context)

    return dependency


def _operation_metadata(
    *, permission_key: str, contracts: list[str], criteria: list[str]
) -> dict[str, object]:
    return {
        "x-vada-permission": permission_key,
        "x-vada-contracts": contracts,
        "x-vada-acceptance-criteria": criteria,
    }


@router.get(
    "/events/{eventId}/purchase-request-editor",
    operation_id="getPurchaseRequestEditorState",
    openapi_extra=_operation_metadata(
        permission_key="purchase_request.draft_read",
        contracts=[
            "API:purchase_request.get_editor_state@R1",
            "AUTH:purchase_request.draft_read@R1",
            "DATA:purchase_request.editor_state@R1",
        ],
        criteria=["FLOW-FIN-001@R2/AC-01", "FLOW-FIN-001@R2/AC-02"],
    ),
)
def get_editor_state(
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.DRAFT_READ)),
    ],
) -> dict[str, object]:
    context, draft = authorized.service.get_editor_state(authorized.context)
    identity = context.actor.identity
    return {
        "organizationId": identity.organization_id,
        "eventId": identity.event_id,
        "eventName": context.event_name,
        "requesterUserId": identity.user_id,
        "requesterName": context.requester_name,
        "requestDepartmentId": context.request_department_id,
        "requestDepartmentName": context.request_department_name,
        "draft": _draft_json(draft) if draft is not None else None,
    }


@router.put(
    "/events/{eventId}/purchase-request-draft",
    operation_id="savePurchaseRequestDraft",
    openapi_extra=_operation_metadata(
        permission_key="purchase_request.draft_write",
        contracts=[
            "API:purchase_request.save_draft@R1",
            "AUTH:purchase_request.draft_write@R1",
            "DATA:purchase_request.draft_save_command@R1",
            "DATA:purchase_request.draft@R1",
        ],
        criteria=["FLOW-FIN-001@R2/AC-02"],
    ),
)
def save_draft(
    command: DraftSaveCommandModel,
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.DRAFT_WRITE)),
    ],
) -> dict[str, object]:
    draft = authorized.service.save_draft(
        authorized.context,
        expected_version=command.expected_version,
        content=command.content.model_dump(
            by_alias=True, exclude_unset=True, mode="json"
        ),
    )
    return _draft_json(draft)


@router.delete(
    "/events/{eventId}/purchase-request-draft",
    status_code=204,
    operation_id="deletePurchaseRequestDraft",
    openapi_extra=_operation_metadata(
        permission_key="purchase_request.draft_delete",
        contracts=[
            "API:purchase_request.delete_draft@R1",
            "AUTH:purchase_request.draft_delete@R1",
            "DATA:http.empty_body@R1",
        ],
        criteria=["FLOW-FIN-001@R2/AC-02"],
    ),
)
def delete_draft(
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.DRAFT_DELETE)),
    ],
) -> Response:
    authorized.service.delete_draft(authorized.context)
    return Response(status_code=204)


@router.post(
    "/events/{eventId}/purchase-requests",
    status_code=201,
    operation_id="submitPurchaseRequest",
    openapi_extra=_operation_metadata(
        permission_key="purchase_request.submit",
        contracts=[
            "API:purchase_request.submit@R1",
            "AUTH:purchase_request.submit@R1",
            "DATA:purchase_request.submit_command@R1",
            "DATA:purchase_request.record@R1",
        ],
        criteria=["FLOW-FIN-001@R2/AC-03", "FLOW-FIN-001@R2/AC-04"],
    ),
)
def submit_purchase_request(
    command: PurchaseRequestSubmitCommandModel,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1)],
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.SUBMIT)),
    ],
) -> dict[str, object]:
    record = authorized.service.submit(
        authorized.context,
        idempotency_key=idempotency_key,
        content=_submission_content(command.content),
        draft_ref=(
            DraftReference(
                draft_id=command.draft_ref.draft_id,
                version=command.draft_ref.version,
            )
            if command.draft_ref is not None
            else None
        ),
    )
    return _record_json(record)


@router.get(
    "/events/{eventId}/purchase-requests/mine",
    operation_id="listOwnPurchaseRequests",
    openapi_extra=_operation_metadata(
        permission_key="purchase_request.list_own",
        contracts=[
            "API:purchase_request.list_own@R1",
            "AUTH:purchase_request.list_own@R1",
            "DATA:purchase_request.own_list@R1",
        ],
        criteria=["FLOW-FIN-001@R2/AC-06"],
    ),
)
def list_own_purchase_requests(
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.LIST_OWN)),
    ],
) -> dict[str, object]:
    return {
        "items": [
            _summary_json(summary)
            for summary in authorized.service.list_own(authorized.context)
        ]
    }


@router.get(
    "/events/{eventId}/purchase-requests/{requestId}",
    operation_id="getPurchaseRequestDetail",
    openapi_extra=_operation_metadata(
        permission_key="purchase_request.read_detail",
        contracts=[
            "API:purchase_request.get_detail@R1",
            "AUTH:purchase_request.read_detail@R1",
            "DATA:purchase_request.record@R1",
        ],
        criteria=["FLOW-FIN-001@R2/AC-07"],
    ),
)
def get_purchase_request_detail(
    request_id: Annotated[str, Path(alias="requestId", min_length=1)],
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.READ_DETAIL)),
    ],
) -> dict[str, object]:
    return _record_json(
        authorized.service.get_detail(authorized.context, request_id=request_id)
    )


def register_purchase_request_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, _request_validation_error)
    for exception_type in (UnauthenticatedError,):
        app.add_exception_handler(
            exception_type,
            _fixed_problem_handler(
                status=401,
                problem_type=UnauthenticatedError.problem_type,
                title=UnauthenticatedError.title,
                detail="인증 정보를 확인할 수 없습니다.",
                code=UnauthenticatedError.code,
                retryable=False,
            ),
        )
    app.add_exception_handler(
        PurchaseRequestActionForbiddenError,
        _fixed_problem_handler(
            status=403,
            problem_type=PurchaseRequestActionForbiddenError.problem_type,
            title=PurchaseRequestActionForbiddenError.title,
            detail="현재 조직에서 이 동작을 수행할 수 없습니다.",
            code=PurchaseRequestActionForbiddenError.code,
            retryable=False,
        ),
    )
    app.add_exception_handler(
        ResourceNotFoundError,
        _fixed_problem_handler(
            status=404,
            problem_type=ResourceNotFoundError.problem_type,
            title=ResourceNotFoundError.title,
            detail="현재 범위에서 요청한 정보를 찾을 수 없습니다.",
            code=ResourceNotFoundError.code,
            retryable=False,
        ),
    )
    app.add_exception_handler(
        PurchaseRequestStateConflictError,
        _fixed_problem_handler(
            status=409,
            problem_type=(
                "https://vada.example/problems/purchase-request-state-conflict"
            ),
            title="구매 요청 상태가 변경되어 다시 확인해야 합니다.",
            detail="최신 상태를 다시 조회한 뒤 시도해 주세요.",
            code="PURCHASE_REQUEST_STATE_CONFLICT",
            retryable=True,
        ),
    )
    app.add_exception_handler(
        PurchaseRequestPersistenceError,
        _fixed_problem_handler(
            status=503,
            problem_type=(
                "https://vada.example/problems/purchase-request-persistence-unavailable"
            ),
            title="지금은 구매 요청을 저장할 수 없습니다.",
            detail="요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            code="PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE",
            retryable=True,
        ),
    )


def _fixed_problem_handler(
    *,
    status: int,
    problem_type: str,
    title: str,
    detail: str,
    code: str,
    retryable: bool,
) -> Callable[[Request, Exception], JSONResponse]:
    def handler(request: Request, _error: Exception) -> JSONResponse:
        return _problem_response(
            request,
            status=status,
            problem_type=problem_type,
            title=title,
            detail=detail,
            code=code,
            retryable=retryable,
        )

    return handler


def _request_validation_error(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, RequestValidationError):
        raise error
    violations = [
        {
            "path": _json_pointer(item["loc"]),
            "code": _validation_code(item),
            "message": _validation_message(item),
        }
        for item in error.errors()
    ]
    return _problem_response(
        request,
        status=422,
        problem_type=(
            "https://vada.example/problems/purchase-request-validation-failed"
        ),
        title="구매 요청 입력을 확인해 주세요.",
        detail="한 개 이상의 입력을 확인해 주세요.",
        code="PURCHASE_REQUEST_VALIDATION_FAILED",
        retryable=False,
        field_violations=violations,
    )


def _problem_response(
    request: Request,
    *,
    status: int,
    problem_type: str,
    title: str,
    detail: str,
    code: str,
    retryable: bool,
    field_violations: list[dict[str, str]] | None = None,
) -> JSONResponse:
    content: dict[str, object] = {
        "type": problem_type,
        "title": title,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        "code": code,
        "retryable": retryable,
    }
    if field_violations:
        content["fieldViolations"] = field_violations
    return JSONResponse(
        status_code=status,
        content=content,
        media_type="application/problem+json",
    )


def _json_pointer(location: tuple[object, ...]) -> str:
    visible = (
        location[1:]
        if location and location[0] in {"body", "header", "path"}
        else location
    )
    return "/" + "/".join(
        str(part).replace("~", "~0").replace("/", "~1") for part in visible
    )


def _validation_code(error: Mapping[str, object]) -> str:
    location = error.get("loc", ())
    if isinstance(location, tuple) and location and location[-1] == "priceEvidence":
        return "PRICE_EVIDENCE_REQUIRED"
    return "INVALID_VALUE"


def _validation_message(error: Mapping[str, object]) -> str:
    location = error.get("loc", ())
    if isinstance(location, tuple) and location and location[-1] == "priceEvidence":
        return "가격 근거를 한 개 이상 입력해 주세요."
    return "입력값을 확인해 주세요."


def _submission_content(model: PurchaseRequestInputModel) -> PurchaseRequestContent:
    return PurchaseRequestContent(
        title=model.title,
        needed_date=model.needed_date,
        purpose=model.purpose,
        priority=model.priority,
        items=tuple(
            PurchaseRequestItemInput(
                name=item.name,
                category=item.category,
                budget_item=item.budget_item,
                purchase_type=item.purchase_type,
                quantity=item.quantity,
                unit=item.unit,
                estimated_unit_price=Decimal(item.estimated_unit_price),
                price_evidence=tuple(
                    evidence.model_dump(by_alias=True, exclude_none=True, mode="json")
                    for evidence in item.price_evidence
                ),
                details=item.details,
            )
            for item in model.items
        ),
    )


def _draft_json(draft: PurchaseRequestDraft) -> dict[str, object]:
    return {
        "draftId": draft.draft_id,
        "version": draft.version,
        "savedAt": _time_text(draft.saved_at),
        "content": dict(draft.content),
    }


def _summary_json(summary: PurchaseRequestSummary) -> dict[str, object]:
    return {
        "requestId": summary.request_id,
        "title": summary.title,
        "status": summary.status,
        "estimatedTotal": _number(summary.estimated_total),
        "overBudget": summary.over_budget,
        "createdAt": _time_text(summary.created_at),
    }


def _record_json(record: PurchaseRequestRecord) -> dict[str, object]:
    return {
        "requestId": record.request_id,
        "organizationId": record.organization_id,
        "eventId": record.event_id,
        "requesterUserId": record.requester_user_id,
        "requestDepartmentId": record.request_department_id,
        "status": record.status,
        "content": {
            "title": record.content.title,
            "neededDate": record.content.needed_date.isoformat(),
            "purpose": record.content.purpose,
            "priority": record.content.priority,
            "items": [
                {
                    "name": item.name,
                    "category": item.category,
                    "budgetItem": item.budget_item,
                    "purchaseType": item.purchase_type,
                    "quantity": _number(item.quantity),
                    "unit": item.unit,
                    "estimatedUnitPrice": _number(item.estimated_unit_price),
                    "priceEvidence": [dict(value) for value in item.price_evidence],
                    "details": dict(item.details),
                }
                for item in record.content.items
            ],
        },
        "itemResults": [
            {
                "itemId": item.item_id,
                "itemPosition": item.item_position,
                "estimatedAmount": _number(item.estimated_amount),
            }
            for item in record.item_results
        ],
        "estimatedTotal": _number(record.estimated_total),
        "overBudget": record.over_budget,
        "createdAt": _time_text(record.created_at),
    }


def _number(value: Decimal) -> int | float:
    return int(value) if value == value.to_integral_value() else float(value)


def _time_text(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")
