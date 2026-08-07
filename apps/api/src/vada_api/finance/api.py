from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, ClassVar, Literal, Protocol, cast

from fastapi import APIRouter, Depends, FastAPI, Header, Path, Request, Response
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    WithJsonSchema,
    model_validator,
)
from pydantic.config import JsonDict

from vada_api.finance.application import (
    FinanceRequestContext,
    PurchaseRequestDraft,
    PurchaseRequestReviewView,
    PurchaseRequestService,
    PurchaseRequestSummary,
)
from vada_api.finance.authorization import (
    PurchaseRequestActionForbiddenError,
    PurchaseRequestPermission,
)
from vada_api.finance.observability import new_operation_correlation_id
from vada_api.finance.review import (
    ItemDecision,
    ItemReviewStatus,
    ReviewConflictError,
    ReviewDecision,
    ReviewDecisionInvalidError,
)
from vada_api.finance.submission import (
    DraftReference,
    PurchaseRequestContent,
    PurchaseRequestItemInput,
    PurchaseRequestNeededDateInPastError,
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


class OmittableNonNullContractModel(ContractModel):
    """Allow omission while rejecting explicit JSON null for contract fields."""

    omittable_non_null_aliases: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="before")
    @classmethod
    def reject_explicit_null_fields(cls, value: object) -> object:
        if not isinstance(value, Mapping):
            return value

        null_fields = sorted(
            alias
            for alias in cls.omittable_non_null_aliases
            if alias in value and value[alias] is None
        )
        if null_fields:
            raise ValueError(
                "생략 가능한 필드도 명시적으로 null일 수 없습니다: "
                + ", ".join(null_fields)
            )
        return cast(object, value)


def _reject_non_json_number(value: object) -> object:
    if isinstance(value, (str, bool)):
        raise ValueError("JSON 숫자만 사용할 수 있습니다.")
    return value


type JsonNumberDecimal = Annotated[
    Decimal,
    BeforeValidator(_reject_non_json_number),
    WithJsonSchema({"type": "number"}, mode="validation"),
    PlainSerializer(float, return_type=float, when_used="json"),
]

type PositiveJsonNumberDecimal = Annotated[
    Decimal,
    BeforeValidator(_reject_non_json_number),
    Field(gt=0),
    WithJsonSchema({"type": "number", "exclusiveMinimum": 0}, mode="validation"),
    WithJsonSchema({"type": "number", "exclusiveMinimum": 0}, mode="serialization"),
    PlainSerializer(float, return_type=float, when_used="json"),
]


def _reject_non_json_integer(value: object) -> object:
    if isinstance(value, (str, bool)):
        raise ValueError("JSON 정수만 사용할 수 있습니다.")
    return value


type JsonInteger = Annotated[int, BeforeValidator(_reject_non_json_integer)]

type PositiveJsonInteger = Annotated[
    int,
    BeforeValidator(_reject_non_json_integer),
    Field(gt=0),
    WithJsonSchema({"type": "integer", "exclusiveMinimum": 0}, mode="validation"),
    WithJsonSchema({"type": "integer", "exclusiveMinimum": 0}, mode="serialization"),
]

type NonNegativeJsonInteger = Annotated[
    int,
    BeforeValidator(_reject_non_json_integer),
    Field(ge=0),
    WithJsonSchema({"type": "integer", "minimum": 0}, mode="validation"),
    WithJsonSchema({"type": "integer", "minimum": 0}, mode="serialization"),
]


class DraftEvidenceModel(OmittableNonNullContractModel):
    omittable_non_null_aliases = frozenset({"type"})

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
    option_quantities: dict[str, JsonNumberDecimal | None] = Field(
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
    deposit_amount: JsonInteger | None = Field(default=None, alias="depositAmount")
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
    quantity: JsonNumberDecimal | None = None
    unit: str = ""
    estimated_unit_price: JsonInteger | None = Field(
        default=None, alias="estimatedUnitPrice"
    )
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
    expected_version: PositiveJsonInteger | None = Field(alias="expectedVersion")
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


class VendorQuoteEvidenceModel(OmittableNonNullContractModel):
    omittable_non_null_aliases = frozenset({"fileRef", "note"})

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


class GeneralDetailsModel(OmittableNonNullContractModel):
    omittable_non_null_aliases = frozenset(
        {"vendor", "productUrl", "options", "deliveryRequest"}
    )

    vendor: str | None = Field(default=None, min_length=1)
    product_url: str | None = Field(default=None, alias="productUrl", min_length=1)
    options: str | None = Field(default=None, min_length=1)
    delivery_request: str | None = Field(
        default=None, alias="deliveryRequest", min_length=1
    )


class ManufacturingPrintingDetailsModel(OmittableNonNullContractModel):
    omittable_non_null_aliases = frozenset(
        {
            "itemKind",
            "specification",
            "color",
            "optionQuantities",
            "printMethod",
            "deliveryDate",
            "fileRefs",
            "requestNote",
        }
    )

    item_kind: str | None = Field(default=None, alias="itemKind", min_length=1)
    specification: str | None = Field(default=None, min_length=1)
    color: str | None = Field(default=None, min_length=1)
    option_quantities: dict[str, PositiveJsonNumberDecimal] | None = Field(
        default=None, alias="optionQuantities", min_length=1
    )
    print_method: str | None = Field(default=None, alias="printMethod", min_length=1)
    delivery_date: date | None = Field(default=None, alias="deliveryDate")
    file_refs: list[Annotated[str, Field(min_length=1)]] | None = Field(
        default=None, alias="fileRefs"
    )
    request_note: str | None = Field(default=None, alias="requestNote", min_length=1)


class RentalDetailsModel(OmittableNonNullContractModel):
    omittable_non_null_aliases = frozenset(
        {
            "vendor",
            "pickupLocation",
            "startDate",
            "endDate",
            "contact",
            "depositAmount",
            "conditions",
        }
    )

    vendor: str | None = Field(default=None, min_length=1)
    pickup_location: str | None = Field(
        default=None, alias="pickupLocation", min_length=1
    )
    start_date: date | None = Field(default=None, alias="startDate")
    end_date: date | None = Field(default=None, alias="endDate")
    contact: str | None = Field(default=None, min_length=1)
    deposit_amount: NonNegativeJsonInteger | None = Field(
        default=None, alias="depositAmount"
    )
    conditions: str | None = Field(default=None, min_length=1)


class ServiceDetailsModel(OmittableNonNullContractModel):
    omittable_non_null_aliases = frozenset(
        {
            "provider",
            "location",
            "startDate",
            "endDate",
            "contact",
            "scope",
            "requestNote",
        }
    )

    provider: str | None = Field(default=None, min_length=1)
    location: str | None = Field(default=None, min_length=1)
    start_date: date | None = Field(default=None, alias="startDate")
    end_date: date | None = Field(default=None, alias="endDate")
    contact: str | None = Field(default=None, min_length=1)
    scope: str | None = Field(default=None, min_length=1)
    request_note: str | None = Field(default=None, alias="requestNote", min_length=1)


class PurchaseRequestItemBaseModel(ContractModel):
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    budget_item: str = Field(alias="budgetItem", min_length=1)
    quantity: PositiveJsonNumberDecimal
    unit: str = Field(min_length=1)
    estimated_unit_price: PositiveJsonInteger = Field(alias="estimatedUnitPrice")


def _require_price_evidence(
    purchase_type: str, price_evidence: list[PriceEvidenceModel]
) -> None:
    evidence_types = {evidence.type for evidence in price_evidence}
    required = (
        {"product_url", "vendor", "price_screenshot"}
        if purchase_type == "general"
        else {"vendor_quote"}
    )
    if not evidence_types.intersection(required):
        raise ValueError("구매 유형에 맞는 가격 근거가 필요합니다.")


_GENERAL_EVIDENCE_SCHEMA_EXTRA: JsonDict = {
    "contains": {
        "type": "object",
        "required": ["type"],
        "properties": {"type": {"enum": ["product_url", "vendor", "price_screenshot"]}},
    }
}
_VENDOR_QUOTE_EVIDENCE_SCHEMA_EXTRA: JsonDict = {
    "contains": {
        "type": "object",
        "required": ["type"],
        "properties": {"type": {"const": "vendor_quote"}},
    }
}


class GeneralPurchaseRequestItemModel(PurchaseRequestItemBaseModel):
    purchase_type: Literal["general"] = Field(alias="purchaseType")
    price_evidence: list[PriceEvidenceModel] = Field(
        alias="priceEvidence",
        min_length=1,
        json_schema_extra=_GENERAL_EVIDENCE_SCHEMA_EXTRA,
    )
    details: GeneralDetailsModel

    @model_validator(mode="after")
    def validate_price_evidence(self) -> GeneralPurchaseRequestItemModel:
        _require_price_evidence(self.purchase_type, self.price_evidence)
        return self


class ManufacturingPrintingPurchaseRequestItemModel(PurchaseRequestItemBaseModel):
    purchase_type: Literal["manufacturing_printing"] = Field(alias="purchaseType")
    price_evidence: list[PriceEvidenceModel] = Field(
        alias="priceEvidence",
        min_length=1,
        json_schema_extra=_VENDOR_QUOTE_EVIDENCE_SCHEMA_EXTRA,
    )
    details: ManufacturingPrintingDetailsModel

    @model_validator(mode="after")
    def validate_price_evidence(
        self,
    ) -> ManufacturingPrintingPurchaseRequestItemModel:
        _require_price_evidence(self.purchase_type, self.price_evidence)
        return self


class RentalPurchaseRequestItemModel(PurchaseRequestItemBaseModel):
    purchase_type: Literal["rental"] = Field(alias="purchaseType")
    price_evidence: list[PriceEvidenceModel] = Field(
        alias="priceEvidence",
        min_length=1,
        json_schema_extra=_VENDOR_QUOTE_EVIDENCE_SCHEMA_EXTRA,
    )
    details: RentalDetailsModel

    @model_validator(mode="after")
    def validate_price_evidence(self) -> RentalPurchaseRequestItemModel:
        _require_price_evidence(self.purchase_type, self.price_evidence)
        return self


class ServicePurchaseRequestItemModel(PurchaseRequestItemBaseModel):
    purchase_type: Literal["service"] = Field(alias="purchaseType")
    price_evidence: list[PriceEvidenceModel] = Field(
        alias="priceEvidence",
        min_length=1,
        json_schema_extra=_VENDOR_QUOTE_EVIDENCE_SCHEMA_EXTRA,
    )
    details: ServiceDetailsModel

    @model_validator(mode="after")
    def validate_price_evidence(self) -> ServicePurchaseRequestItemModel:
        _require_price_evidence(self.purchase_type, self.price_evidence)
        return self


type PurchaseRequestItemModel = Annotated[
    GeneralPurchaseRequestItemModel
    | ManufacturingPrintingPurchaseRequestItemModel
    | RentalPurchaseRequestItemModel
    | ServicePurchaseRequestItemModel,
    Field(discriminator="purchase_type"),
]


class PurchaseRequestInputModel(ContractModel):
    title: str = Field(min_length=1)
    needed_date: date = Field(alias="neededDate")
    purpose: str = Field(min_length=1)
    priority: Literal["normal", "urgent"]
    items: list[PurchaseRequestItemModel] = Field(min_length=1)


class DraftReferenceModel(ContractModel):
    draft_id: str = Field(alias="draftId", min_length=1)
    version: PositiveJsonInteger


class PurchaseRequestSubmitCommandModel(OmittableNonNullContractModel):
    omittable_non_null_aliases = frozenset({"draftRef"})

    content: PurchaseRequestInputModel
    draft_ref: DraftReferenceModel | None = Field(default=None, alias="draftRef")


class PurchaseRequestDraftResponse(ContractModel):
    draft_id: str = Field(alias="draftId", min_length=1)
    version: int = Field(ge=1)
    saved_at: str = Field(alias="savedAt", min_length=1)
    content: DraftContentModel


class PurchaseRequestEditorStateResponse(ContractModel):
    organization_id: str = Field(alias="organizationId", min_length=1)
    event_id: str = Field(alias="eventId", min_length=1)
    event_name: str = Field(alias="eventName", min_length=1)
    requester_user_id: str = Field(alias="requesterUserId", min_length=1)
    requester_name: str = Field(alias="requesterName", min_length=1)
    request_department_id: str = Field(alias="requestDepartmentId", min_length=1)
    request_department_name: str = Field(alias="requestDepartmentName", min_length=1)
    draft: PurchaseRequestDraftResponse | None


class PurchaseRequestItemResultResponse(ContractModel):
    item_id: str = Field(alias="itemId", min_length=1)
    item_position: int = Field(alias="itemPosition", ge=0)
    estimated_amount: float = Field(alias="estimatedAmount", gt=0)


class PurchaseRequestRecordResponse(ContractModel):
    request_id: str = Field(alias="requestId", min_length=1)
    organization_id: str = Field(alias="organizationId", min_length=1)
    event_id: str = Field(alias="eventId", min_length=1)
    requester_user_id: str = Field(alias="requesterUserId", min_length=1)
    request_department_id: str = Field(alias="requestDepartmentId", min_length=1)
    status: Literal["review_pending"]
    content: PurchaseRequestInputModel
    item_results: list[PurchaseRequestItemResultResponse] = Field(
        alias="itemResults", min_length=1
    )
    estimated_total: float = Field(alias="estimatedTotal", gt=0)
    over_budget: bool = Field(alias="overBudget")
    created_at: str = Field(alias="createdAt", min_length=1)


class PurchaseRequestDisplayResponse(ContractModel):
    event_name: str = Field(alias="eventName", min_length=1)
    requester_name: str = Field(alias="requesterName", min_length=1)


class PurchaseRequestDetailViewResponse(ContractModel):
    record: PurchaseRequestRecordResponse
    display: PurchaseRequestDisplayResponse


class PurchaseRequestSummaryResponse(ContractModel):
    request_id: str = Field(alias="requestId", min_length=1)
    title: str = Field(min_length=1)
    status: str = Field(min_length=1)
    estimated_total: float = Field(alias="estimatedTotal", gt=0)
    over_budget: bool = Field(alias="overBudget")
    created_at: str = Field(alias="createdAt", min_length=1)


class ItemReviewStateResponse(ContractModel):
    item_id: str = Field(alias="itemId", min_length=1)
    review_status: Literal[
        "review_pending", "approved", "revision_requested", "rejected"
    ] = Field(alias="reviewStatus")
    revision_reason: str | None = Field(default=None, alias="revisionReason")
    revision_due_date: date | None = Field(default=None, alias="revisionDueDate")
    rejection_reason: str | None = Field(default=None, alias="rejectionReason")


class PurchaseRequestReviewViewResponse(ContractModel):
    detail: PurchaseRequestDetailViewResponse
    item_review_states: list[ItemReviewStateResponse] = Field(alias="itemReviewStates")


class ItemDecisionCommandModel(ContractModel):
    """CB-FIN-003의 결정 입력. 결정마다 필요한 값이 다르다."""

    decision: Literal["approve", "request_revision", "reject"]
    expected_review_status: Literal[
        "review_pending", "approved", "revision_requested", "rejected"
    ] = Field(alias="expectedReviewStatus")
    revision_reason: str | None = Field(
        default=None, alias="revisionReason", min_length=1
    )
    revision_due_date: date | None = Field(default=None, alias="revisionDueDate")
    rejection_reason: str | None = Field(
        default=None, alias="rejectionReason", min_length=1
    )


class PurchaseRequestOwnListResponse(ContractModel):
    items: list[PurchaseRequestSummaryResponse]


class FieldViolationResponse(ContractModel):
    path: str = Field(min_length=1)
    code: str = Field(min_length=1)
    message: str = Field(min_length=1)


class ProblemDetailsResponse(ContractModel):
    type: str = Field(min_length=1)
    title: str = Field(min_length=1)
    status: int = Field(ge=400, le=599)
    detail: str | None = Field(default=None, min_length=1)
    instance: str | None = Field(default=None, min_length=1)
    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]*$")
    retryable: bool | None = None
    field_violations: list[FieldViolationResponse] | None = Field(
        default=None, alias="fieldViolations"
    )


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


_OPERATION_METADATA: dict[str, dict[str, object]] = {
    "editor": {
        "x-vada-permission": "purchase_request.draft_read",
        "x-vada-contracts": [
            "API:purchase_request.get_editor_state@R1",
            "AUTH:purchase_request.draft_read@R1",
            "DATA:http.empty_body@R1",
            "DATA:purchase_request.editor_state@R1",
            "ERROR:http.unauthenticated@R1",
            "ERROR:purchase_request.action_forbidden@R1",
            "ERROR:http.resource_not_found@R1",
            "ERROR:purchase_request.persistence_unavailable@R1",
            "DATA:http.problem_details@R1",
        ],
        "x-vada-acceptance-criteria": [
            "FLOW-FIN-001@R2/AC-04",
            "FLOW-FIN-001@R2/AC-05",
        ],
    },
    "save_draft": {
        "x-vada-permission": "purchase_request.draft_write",
        "x-vada-contracts": [
            "API:purchase_request.save_draft@R1",
            "AUTH:purchase_request.draft_write@R1",
            "DATA:purchase_request.draft_save_command@R1",
            "DATA:purchase_request.draft@R1",
            "ERROR:http.unauthenticated@R1",
            "ERROR:purchase_request.action_forbidden@R1",
            "ERROR:http.resource_not_found@R1",
            "ERROR:purchase_request.validation_failed@R1",
            "ERROR:purchase_request.state_conflict@R1",
            "ERROR:purchase_request.persistence_unavailable@R1",
            "DATA:http.problem_details@R1",
        ],
        "x-vada-acceptance-criteria": [
            "FLOW-FIN-001@R2/AC-05",
            "FLOW-FIN-001@R2/AC-08",
        ],
    },
    "delete_draft": {
        "x-vada-permission": "purchase_request.draft_delete",
        "x-vada-contracts": [
            "API:purchase_request.delete_draft@R1",
            "AUTH:purchase_request.draft_delete@R1",
            "DATA:http.empty_body@R1",
            "ERROR:http.unauthenticated@R1",
            "ERROR:http.resource_not_found@R1",
            "ERROR:purchase_request.persistence_unavailable@R1",
            "DATA:http.problem_details@R1",
        ],
        "x-vada-acceptance-criteria": ["FLOW-FIN-001@R2/AC-05"],
    },
    "submit": {
        "x-vada-permission": "purchase_request.submit",
        "x-vada-contracts": [
            "API:purchase_request.submit@R1",
            "AUTH:purchase_request.submit@R1",
            "DATA:purchase_request.submit_command@R1",
            "DATA:purchase_request.record@R1",
            "ERROR:http.unauthenticated@R1",
            "ERROR:purchase_request.action_forbidden@R1",
            "ERROR:http.resource_not_found@R1",
            "ERROR:purchase_request.validation_failed@R1",
            "ERROR:purchase_request.state_conflict@R1",
            "ERROR:purchase_request.persistence_unavailable@R1",
            "DATA:http.problem_details@R1",
        ],
        "x-vada-acceptance-criteria": [
            "FLOW-FIN-001@R2/AC-01",
            "FLOW-FIN-001@R2/AC-02",
            "FLOW-FIN-001@R2/AC-03",
            "FLOW-FIN-001@R2/AC-04",
            "FLOW-FIN-001@R2/AC-06",
        ],
    },
    "own_list": {
        "x-vada-permission": "purchase_request.list_own",
        "x-vada-contracts": [
            "API:purchase_request.list_own@R1",
            "AUTH:purchase_request.list_own@R1",
            "DATA:http.empty_body@R1",
            "DATA:purchase_request.own_list@R1",
            "ERROR:http.unauthenticated@R1",
            "ERROR:purchase_request.action_forbidden@R1",
            "ERROR:http.resource_not_found@R1",
            "ERROR:purchase_request.persistence_unavailable@R1",
            "DATA:http.problem_details@R1",
        ],
        "x-vada-acceptance-criteria": [
            "FLOW-FIN-001@R2/AC-01",
            "FLOW-FIN-001@R2/AC-02",
            "FLOW-FIN-001@R2/AC-07",
        ],
    },
    "detail": {
        "x-vada-permission": "purchase_request.read_detail",
        "x-vada-contracts": [
            "API:purchase_request.get_detail@R2",
            "AUTH:purchase_request.read_detail@R1",
            "DATA:http.empty_body@R1",
            "DATA:purchase_request.detail_view@R1",
            "ERROR:http.unauthenticated@R1",
            "ERROR:http.resource_not_found@R1",
            "ERROR:purchase_request.persistence_unavailable@R1",
            "DATA:http.problem_details@R1",
        ],
        "x-vada-acceptance-criteria": ["FLOW-FIN-001@R2/AC-07"],
    },
    "review": {
        "x-vada-permission": "purchase_request.review",
        "x-vada-contracts": [
            "API:purchase_request.get_review@R1",
            "AUTH:purchase_request.review@R1",
            "DATA:http.empty_body@R1",
            "DATA:purchase_request.review_view@R1",
            "DATA:purchase_request.item_review_state@R1",
            "ERROR:http.unauthenticated@R1",
            "ERROR:purchase_request.action_forbidden@R1",
            "ERROR:http.resource_not_found@R1",
            "ERROR:purchase_request.persistence_unavailable@R1",
            "DATA:http.problem_details@R1",
        ],
    },
    "decide_item": {
        "x-vada-permission": "purchase_request.review",
        "x-vada-contracts": [
            "API:purchase_request.decide_item@R1",
            "AUTH:purchase_request.review@R1",
            "DATA:purchase_request.item_decision@R1",
            "DATA:purchase_request.review_view@R1",
            "DATA:purchase_request.item_review_state@R1",
            "ERROR:http.unauthenticated@R1",
            "ERROR:purchase_request.action_forbidden@R1",
            "ERROR:http.resource_not_found@R1",
            "ERROR:purchase_request.persistence_unavailable@R1",
            "DATA:http.problem_details@R1",
        ],
    },
}

_PROBLEM_DESCRIPTIONS = {
    401: "인증 정보가 없거나 유효하지 않은 요청을 표현합니다.",
    403: "현재 조직에서 알려진 작성 동작을 수행할 관계가 없음을 표현합니다.",
    404: "리소스 부재와 조직 범위 밖 접근을 구분하지 않고 표현합니다.",
    409: "초안 리비전 또는 멱등성 재시도 내용이 충돌함을 표현합니다.",
    422: "구매 요청이나 품목 입력이 계약을 만족하지 못함을 표현합니다.",
    503: "초안 또는 요청을 안전하게 저장할 수 없는 일시 장애를 표현합니다.",
}

_ERROR_CONTRACTS = {
    401: "ERROR:http.unauthenticated@R1",
    403: "ERROR:purchase_request.action_forbidden@R1",
    404: "ERROR:http.resource_not_found@R1",
    409: "ERROR:purchase_request.state_conflict@R1",
    422: "ERROR:purchase_request.validation_failed@R1",
    503: "ERROR:purchase_request.persistence_unavailable@R1",
}

_CANONICAL_RESPONSE_STATUSES = {
    "getPurchaseRequestEditorState": {"200", "401", "403", "404", "503"},
    "savePurchaseRequestDraft": {
        "200",
        "401",
        "403",
        "404",
        "409",
        "422",
        "503",
    },
    "deletePurchaseRequestDraft": {"204", "401", "404", "503"},
    "submitPurchaseRequest": {
        "201",
        "401",
        "403",
        "404",
        "409",
        "422",
        "503",
    },
    "listOwnPurchaseRequests": {"200", "401", "403", "404", "503"},
    "getPurchaseRequestDetail": {"200", "401", "404", "503"},
}


def _operation_metadata(key: str) -> dict[str, object]:
    return _OPERATION_METADATA[key]


def _problem_responses(
    *statuses: int,
) -> dict[int | str, dict[str, Any]]:
    schema = ProblemDetailsResponse.model_json_schema(by_alias=True)
    return {
        status: {
            "description": _PROBLEM_DESCRIPTIONS[status],
            "x-vada-contract": _ERROR_CONTRACTS[status],
            "content": {"application/problem+json": {"schema": schema}},
        }
        for status in statuses
    }


def normalize_purchase_request_openapi(
    schema: dict[str, object],
) -> dict[str, object]:
    """Remove FastAPI's unreachable implicit 422 entries from contracted routes."""

    raw_paths = schema.get("paths")
    if not isinstance(raw_paths, dict):
        return schema
    paths = cast(dict[str, object], raw_paths)
    for raw_path_item in paths.values():
        if not isinstance(raw_path_item, dict):
            continue
        path_item = cast(dict[str, object], raw_path_item)
        for raw_operation in path_item.values():
            if not isinstance(raw_operation, dict):
                continue
            operation = cast(dict[str, object], raw_operation)
            operation_id = operation.get("operationId")
            if not isinstance(operation_id, str):
                continue
            allowed = _CANONICAL_RESPONSE_STATUSES.get(operation_id)
            raw_responses = operation.get("responses")
            if allowed is None or not isinstance(raw_responses, dict):
                continue
            responses = cast(dict[str, object], raw_responses)
            for status in set(responses) - allowed:
                del responses[status]
    return schema


@router.get(
    "/events/{eventId}/purchase-request-editor",
    operation_id="getPurchaseRequestEditorState",
    response_model=PurchaseRequestEditorStateResponse,
    response_model_exclude_unset=True,
    responses=_problem_responses(401, 403, 404, 503),
    openapi_extra=_operation_metadata("editor"),
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
    response_model=PurchaseRequestDraftResponse,
    response_model_exclude_unset=True,
    responses=_problem_responses(401, 403, 404, 409, 422, 503),
    openapi_extra=_operation_metadata("save_draft"),
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
    responses=_problem_responses(401, 404, 503),
    openapi_extra=_operation_metadata("delete_draft"),
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
    response_model=PurchaseRequestRecordResponse,
    response_model_exclude_none=True,
    responses=_problem_responses(401, 403, 404, 409, 422, 503),
    openapi_extra=_operation_metadata("submit"),
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
    response_model=PurchaseRequestOwnListResponse,
    responses=_problem_responses(401, 403, 404, 503),
    openapi_extra=_operation_metadata("own_list"),
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
    response_model=PurchaseRequestDetailViewResponse,
    response_model_exclude_none=True,
    responses=_problem_responses(401, 404, 503),
    openapi_extra=_operation_metadata("detail"),
)
def get_purchase_request_detail(
    request_id: Annotated[str, Path(alias="requestId", min_length=1)],
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.READ_DETAIL)),
    ],
) -> dict[str, object]:
    detail = authorized.service.get_detail(authorized.context, request_id=request_id)
    return {
        "record": _record_json(detail.record),
        "display": {
            "eventName": detail.display.event_name,
            "requesterName": detail.display.requester_name,
        },
    }


def _review_json(view: PurchaseRequestReviewView) -> dict[str, object]:
    return {
        "detail": {
            "record": _record_json(view.detail.record),
            "display": {
                "eventName": view.detail.display.event_name,
                "requesterName": view.detail.display.requester_name,
            },
        },
        "itemReviewStates": [
            {
                "itemId": state.item_id,
                "reviewStatus": str(state.review_status),
                **(
                    {"revisionReason": state.revision_reason}
                    if state.revision_reason is not None
                    else {}
                ),
                **(
                    {"revisionDueDate": state.revision_due_date.isoformat()}
                    if state.revision_due_date is not None
                    else {}
                ),
                **(
                    {"rejectionReason": state.rejection_reason}
                    if state.rejection_reason is not None
                    else {}
                ),
            }
            for state in view.item_review_states
        ],
    }


@router.get(
    "/events/{eventId}/purchase-requests/{requestId}/review",
    operation_id="getPurchaseRequestReview",
    response_model=PurchaseRequestReviewViewResponse,
    response_model_exclude_none=True,
    responses=_problem_responses(401, 403, 404, 503),
    openapi_extra=_operation_metadata("review"),
)
def get_purchase_request_review(
    request_id: Annotated[str, Path(alias="requestId", min_length=1)],
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.REVIEW)),
    ],
) -> dict[str, object]:
    return _review_json(
        authorized.service.get_review(authorized.context, request_id=request_id)
    )


@router.put(
    "/events/{eventId}/purchase-requests/{requestId}/items/{itemId}/review",
    operation_id="decidePurchaseRequestItem",
    response_model=PurchaseRequestReviewViewResponse,
    response_model_exclude_none=True,
    responses=_problem_responses(401, 403, 404, 409, 422, 503),
    openapi_extra=_operation_metadata("decide_item"),
)
def decide_purchase_request_item(
    command: ItemDecisionCommandModel,
    request_id: Annotated[str, Path(alias="requestId", min_length=1)],
    item_id: Annotated[str, Path(alias="itemId", min_length=1)],
    authorized: Annotated[
        AuthorizedPurchaseRequest,
        Depends(require_permission(PurchaseRequestPermission.REVIEW)),
    ],
) -> dict[str, object]:
    return _review_json(
        authorized.service.decide_item(
            authorized.context,
            request_id=request_id,
            item_id=item_id,
            decision=ItemDecision(
                decision=ReviewDecision(command.decision),
                expected_review_status=ItemReviewStatus(command.expected_review_status),
                revision_reason=command.revision_reason,
                revision_due_date=command.revision_due_date,
                rejection_reason=command.rejection_reason,
            ),
        )
    )


def register_purchase_request_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, _request_validation_error)
    app.add_exception_handler(
        PurchaseRequestNeededDateInPastError,
        _needed_date_in_past_handler,
    )
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
        ReviewConflictError,
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
        ReviewDecisionInvalidError,
        _fixed_problem_handler(
            status=422,
            problem_type=(
                "https://vada.example/problems/purchase-request-validation-failed"
            ),
            title="검토 결정 입력이 계약을 만족하지 못합니다.",
            detail="결정 종류에 필요한 값을 확인해 주세요.",
            code="PURCHASE_REQUEST_VALIDATION_FAILED",
            retryable=False,
        ),
    )
    app.add_exception_handler(
        PurchaseRequestPersistenceError,
        _persistence_problem_handler,
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


async def _request_validation_error(request: Request, error: Exception) -> Response:
    if not isinstance(error, RequestValidationError):
        raise error
    route = request.scope.get("route")
    if not isinstance(route, APIRoute) or "Purchase Requests" not in route.tags:
        return await request_validation_exception_handler(request, error)
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


def _needed_date_in_past_handler(request: Request, _error: Exception) -> JSONResponse:
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
        field_violations=[
            {
                "path": "/content/neededDate",
                "code": "INVALID_VALUE",
                "message": "필요일은 오늘 이전일 수 없습니다.",
            }
        ],
    )


def _persistence_problem_handler(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, PurchaseRequestPersistenceError):
        raise error
    correlation_id = error.correlation_id or new_operation_correlation_id()
    return _problem_response(
        request,
        status=503,
        problem_type=(
            "https://vada.example/problems/purchase-request-persistence-unavailable"
        ),
        title="지금은 구매 요청을 저장할 수 없습니다.",
        detail="요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code="PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE",
        retryable=True,
        instance=f"urn:vada:problem:{correlation_id}",
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
    instance: str | None = None,
) -> JSONResponse:
    content: dict[str, object] = {
        "type": problem_type,
        "title": title,
        "status": status,
        "detail": detail,
        "instance": instance or request.url.path,
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
                details=item.details.model_dump(
                    by_alias=True, exclude_none=True, mode="json"
                ),
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
