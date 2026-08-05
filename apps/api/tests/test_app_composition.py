from typing import cast

from sqlalchemy import Engine

from vada_api.finance.application import PurchaseRequestService
from vada_api.finance.persistence.context import (
    PostgreSQLPurchaseRequestContextProvider,
)
from vada_api.finance.persistence.relationships import (
    PostgreSQLPurchaseRequestRelationshipReader,
)
from vada_api.main import create_app


def test_explicit_engine_wires_production_purchase_request_adapters() -> None:
    engine = cast(Engine, object())

    app = create_app(engine=engine)

    assert isinstance(
        app.state.purchase_request_context_provider,
        PostgreSQLPurchaseRequestContextProvider,
    )
    assert isinstance(
        app.state.purchase_request_relationship_reader,
        PostgreSQLPurchaseRequestRelationshipReader,
    )
    assert isinstance(app.state.purchase_request_service, PurchaseRequestService)
