from inspect import Parameter, signature
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


def test_every_optional_collaborator_of_the_assembled_service_is_wired() -> None:
    """선택 인자로 둔 저장소가 조립에서 빠지면 그 화면은 배포에서만 503이 된다.

    실제로 검토 저장소가 빠져 있었다. 라우트도 테스트도 통과하는데, 테스트가
    가짜 저장소를 직접 주입하기 때문이다. 배포된 서버만 실패한다.

    목록을 손으로 관리하면 다음 저장소에서 또 빠진다. 생성자에서 읽는다.
    """

    app = create_app(engine=cast(Engine, object()))
    service = app.state.purchase_request_service

    optional = [
        name
        for name, parameter in signature(
            PurchaseRequestService.__init__
        ).parameters.items()
        if parameter.kind is Parameter.KEYWORD_ONLY and parameter.default is None
    ]
    missing = [name for name in optional if getattr(service, f"_{name}") is None]

    assert optional, "선택 협력자를 하나도 못 읽었습니다. 검사가 비어 있습니다."
    assert missing == [], f"조립에서 빠진 저장소: {missing}"
