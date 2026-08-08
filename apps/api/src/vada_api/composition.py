from __future__ import annotations

from fastapi import FastAPI
from sqlalchemy import Engine, create_engine

from vada_api.database import resolve_database_url
from vada_api.finance.application import PurchaseRequestService
from vada_api.finance.persistence.context import (
    PostgreSQLPurchaseRequestContextProvider,
)
from vada_api.finance.persistence.event_finance import PostgreSQLEventFinanceReader
from vada_api.finance.persistence.purchase_requests import (
    PostgreSQLPurchaseRequestRepository,
)
from vada_api.finance.persistence.relationships import (
    PostgreSQLPurchaseRequestRelationshipReader,
)
from vada_api.finance.persistence.reviews import PostgreSQLPurchaseRequestReviewStore
from vada_api.finance.persistence.revisions import (
    PostgreSQLPurchaseRequestRevisionStore,
)
from vada_api.finance.persistence.submission import (
    PostgreSQLPurchaseRequestSubmissionStore,
)
from vada_api.identity.persistence.relationships import (
    PostgreSQLIdentityOrganizationRepository,
)
from vada_api.organization.application import MemberRoleService
from vada_api.organization.persistence.context import (
    PostgreSQLOrganizationContextProvider,
)
from vada_api.organization.persistence.member_roles import PostgreSQLMemberRoleStore


def database_engine_from_environment() -> Engine | None:
    database_url = resolve_database_url()
    if database_url is None:
        return None
    return create_engine(database_url, pool_pre_ping=True)


def configure_postgresql_dependencies(application: FastAPI, engine: Engine) -> None:
    relationships = PostgreSQLIdentityOrganizationRepository(engine)
    context_provider = PostgreSQLPurchaseRequestContextProvider(relationships)
    relationship_reader = PostgreSQLPurchaseRequestRelationshipReader(relationships)
    request_repository = PostgreSQLPurchaseRequestRepository(engine)
    submission_store = PostgreSQLPurchaseRequestSubmissionStore(engine)
    review_store = PostgreSQLPurchaseRequestReviewStore(engine)
    revision_store = PostgreSQLPurchaseRequestRevisionStore(engine)
    event_finance_reader = PostgreSQLEventFinanceReader(engine, names=relationships)

    application.state.organization_context_provider = (
        PostgreSQLOrganizationContextProvider(relationships)
    )
    application.state.member_role_service = MemberRoleService(
        PostgreSQLMemberRoleStore(engine)
    )
    application.state.purchase_request_context_provider = context_provider
    application.state.purchase_request_relationship_reader = relationship_reader
    application.state.purchase_request_service = PurchaseRequestService(
        request_repository,
        submission_store,
        relationship_reader=relationship_reader,
        review_store=review_store,
        revision_store=revision_store,
        event_finance_reader=event_finance_reader,
    )
