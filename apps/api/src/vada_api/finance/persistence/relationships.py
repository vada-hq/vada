from __future__ import annotations

from typing import Protocol

from sqlalchemy.exc import SQLAlchemyError

from vada_api.finance.application import PurchaseRequestDisplayNames
from vada_api.finance.submission import PurchaseRequestPersistenceError
from vada_api.identity.persistence.relationships import RelationshipDisplayNames


class DisplayRelationshipRepository(Protocol):
    def find_member_display_names(
        self, *, organization_id: str, user_ids: frozenset[str]
    ) -> dict[str, str]: ...

    def find_display_names(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> RelationshipDisplayNames | None: ...


class PostgreSQLPurchaseRequestRelationshipReader:
    """Adapt organization relationship rows to the finance display port."""

    def __init__(self, repository: DisplayRelationshipRepository) -> None:
        self._repository = repository

    def get_detail_display_names(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> PurchaseRequestDisplayNames | None:
        try:
            names = self._repository.find_display_names(
                organization_id=organization_id,
                event_id=event_id,
                requester_user_id=requester_user_id,
            )
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error
        if names is None:
            return None
        return PurchaseRequestDisplayNames(
            event_name=names.event_name,
            requester_name=names.requester_name,
        )

    def get_member_display_names(
        self, *, organization_id: str, user_ids: frozenset[str]
    ) -> dict[str, str]:
        """처리 기록의 처리자 이름. 사건 수만큼 조회하지 않고 한 번에 읽는다."""

        try:
            return self._repository.find_member_display_names(
                organization_id=organization_id, user_ids=user_ids
            )
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error
