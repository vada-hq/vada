"""자기 신원과 전역 판정을 읽는 사용 사례. 계약 CB-IDENTITY-001@R1이 기준이다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from vada_api.identity.context import TrustedOrganizationOnlyContext
from vada_api.identity.errors import ResourceNotFoundError
from vada_api.organization.roles import MemberRole
from vada_api.session.authorization import (
    SessionPermission,
    require_session_permission,
)
from vada_api.session.viewer import GlobalCapabilities, decide_global_capabilities


class SessionPersistenceError(Exception):
    """세션 저장소를 지금 쓸 수 없다. 실패를 성공으로 꾸미지 않는다."""


@dataclass(frozen=True, slots=True)
class ViewerFacts:
    """전역 판정에 필요한 사실 전부. 저장소가 조직 범위 안에서 읽어 온다."""

    display_name: str
    organization_name: str
    role: MemberRole
    is_finance_member: bool


class ViewerStore(Protocol):
    def find_viewer_facts(
        self, *, user_id: str, organization_id: str, membership_id: str
    ) -> ViewerFacts | None: ...


@dataclass(frozen=True, slots=True)
class SessionViewer:
    """화면이 그리는 "나". 이름과 조직 이름은 표시 전용이다."""

    user_id: str
    display_name: str
    organization_id: str
    organization_name: str
    capabilities: GlobalCapabilities


class SessionViewerService:
    def __init__(self, store: ViewerStore) -> None:
        self._store = store

    def read_viewer(self, context: TrustedOrganizationOnlyContext) -> SessionViewer:
        require_session_permission(SessionPermission.READ_SELF, context=context)

        facts = self._store.find_viewer_facts(
            user_id=context.user_id,
            organization_id=context.organization_id,
            membership_id=context.membership_id,
        )
        if facts is None:
            # 맥락은 섰는데 사실이 없다. 그 사이에 소속이 끊겼거나 데이터가
            # 어긋난 것이다. 비어 있는 이름으로 화면을 그리지 않는다.
            raise ResourceNotFoundError

        return SessionViewer(
            user_id=context.user_id,
            display_name=facts.display_name,
            organization_id=context.organization_id,
            organization_name=facts.organization_name,
            capabilities=decide_global_capabilities(
                role=facts.role, is_finance_member=facts.is_finance_member
            ),
        )
