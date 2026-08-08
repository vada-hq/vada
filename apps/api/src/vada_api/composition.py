from __future__ import annotations

import os

from fastapi import FastAPI
from sqlalchemy import Engine, create_engine

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
from vada_api.finance.persistence.submission import (
    PostgreSQLPurchaseRequestSubmissionStore,
)
from vada_api.identity.persistence.relationships import (
    PostgreSQLIdentityOrganizationRepository,
)

DATABASE_URL_ENVIRONMENT_VARIABLE = "VADA_DATABASE_URL"


def database_engine_from_environment() -> Engine | None:
    database_url = os.getenv(DATABASE_URL_ENVIRONMENT_VARIABLE)
    if database_url is None or not database_url.strip():
        return None
    return create_engine(database_url, pool_pre_ping=True)


def configure_postgresql_dependencies(application: FastAPI, engine: Engine) -> None:
    relationships = PostgreSQLIdentityOrganizationRepository(engine)
    context_provider = PostgreSQLPurchaseRequestContextProvider(relationships)
    relationship_reader = PostgreSQLPurchaseRequestRelationshipReader(relationships)
    request_repository = PostgreSQLPurchaseRequestRepository(engine)
    submission_store = PostgreSQLPurchaseRequestSubmissionStore(engine)
    review_store = PostgreSQLPurchaseRequestReviewStore(engine)
    event_finance_reader = PostgreSQLEventFinanceReader(engine, names=relationships)

    application.state.purchase_request_context_provider = context_provider
    application.state.purchase_request_relationship_reader = relationship_reader
    application.state.purchase_request_service = PurchaseRequestService(
        request_repository,
        submission_store,
        relationship_reader=relationship_reader,
        review_store=review_store,
        event_finance_reader=event_finance_reader,
    )
