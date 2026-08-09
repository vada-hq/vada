# pyright: reportUnknownMemberType=false, reportUnknownArgumentType=false
"""서버가 실제로 내보내는 응답이 **계약이 약속한 모양인가.**

지금까지 이것을 보는 곳은 구매 요청 하나뿐이었다. 나머지 계약은 이렇게 돌았다 —
필드 이름을 사람이 손으로 적고, 그 사람이 쓴 테스트가 검사하고, 그 사람이 쓴
화면이 읽는다. `displayName`을 `displayname`으로 오타 내도 **전부 초록불**이고
`just api`는 여전히 "구현"이라 찍는다. 셋이 같은 오타를 공유하기 때문이다.

여기서는 계약 JSON Schema를 판정 기준으로 쓴다. 계약은 대부분
`additionalProperties: false`라 이름을 하나만 틀려도 걸린다.

**이 검사는 표를 강제한다.** 서버가 구현했다고 선언한 API 계약 중 아래 표에
없는 것이 있으면 실패한다. 계약을 새로 구현하면 한 줄을 더해야 하고, 그 줄이
실제 응답을 계약에 통과시킨다. 새 계약이 조용히 검증 밖에 남지 않는다.

구현 목록은 **서버 자신에게 묻는다.** 라우트가 `x-vada-contracts`로 선언한 것이
곧 "구현했다"는 주장이고, `just api`도 같은 것을 읽는다. 목록을 여기 다시 적으면
그 사본이 언젠가 낡는다.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012
from scripts import seed_local
from sqlalchemy import Engine
from starlette.types import ASGIApp, Receive, Scope, Send

from vada_api.main import create_app

pytestmark = pytest.mark.postgres

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
BUNDLES = REPOSITORY_ROOT / "contracts" / "bundles"
FIXTURES = REPOSITORY_ROOT / "contracts" / "fixtures"

EVENT = seed_local.EVENT
REQUEST = seed_local.REQUEST
FINANCE = seed_local.FINANCE
PRESIDENT = seed_local.PRESIDENT
PLAIN = seed_local.MEMBER

EMPTY_BODY = "DATA:http.empty_body@R1"


# ---------------------------------------------------------------------------
# 계약 읽기
# ---------------------------------------------------------------------------
@cache
def _contracts() -> dict[str, dict[str, Any]]:
    """번들을 가로질러 계약을 id로 찾는다. 계약은 다른 번들의 것을 참조한다."""
    found: dict[str, dict[str, Any]] = {}
    for path in sorted(BUNDLES.rglob("R*.json")):
        bundle = cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
        for contract in bundle.get("contracts", []):
            found[contract["id"]] = contract
    return found


@cache
def _served_api_contract_ids() -> frozenset[str]:
    """서버가 스스로 구현했다고 선언한 API 계약."""
    document = create_app().openapi()
    served: set[str] = set()
    for operations in document["paths"].values():
        for operation in operations.values():
            for contract_id in operation.get("x-vada-contracts", []):
                if contract_id.startswith("API:"):
                    served.add(contract_id)
    return frozenset(served)


@cache
def _registry() -> Registry[Any]:
    """계약 스키마끼리 `$id`로 서로를 가리킨다. 그 이름을 여기서 풀어 준다.

    안 주면 검증기가 `urn:vada:...`를 인터넷에서 찾으려 든다 — 검사가 네트워크에
    기대게 되고, 끊기면 계약 위반과 구분되지 않는 실패가 난다.
    """
    resources: list[tuple[str, Resource[Any]]] = []
    for contract in _contracts().values():
        schema = contract["specification"].get("json_schema")
        if isinstance(schema, dict) and "$id" in schema:
            resources.append(
                (
                    cast(str, schema["$id"]),
                    Resource(contents=schema, specification=DRAFT202012),
                )
            )
    registry: Registry[Any] = Registry()
    return registry.with_resources(resources)


def _success(contract_id: str) -> dict[str, Any]:
    return cast(dict[str, Any], _contracts()[contract_id]["specification"]["success"])


def _example(fixture_set: str, example_id: str) -> dict[str, Any]:
    """승인된 계약 픽스처의 값. 요청 본문을 손으로 짓지 않는다."""
    document = cast(
        dict[str, Any],
        json.loads((FIXTURES / fixture_set).read_text(encoding="utf-8")),
    )
    for example in document["data_examples"]:
        if example["id"] == example_id:
            return cast(dict[str, Any], example["value"])
    raise AssertionError(f"{fixture_set}에 {example_id} 예제가 없습니다.")


# ---------------------------------------------------------------------------
# 어떻게 부르는가
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Call:
    """계약 하나를 실제로 부르는 방법.

    `prepare`는 지금 저장된 상태에 기대는 요청이 쓴다. 시드의 값을 여기 베껴
    두면 시드가 바뀔 때 이 표가 조용히 낡는다.
    """

    method: str
    path: str
    subject: str
    body: dict[str, Any] | None = None
    headers: dict[str, str] | None = None
    prepare: Callable[[TestClient], tuple[str, dict[str, Any] | None]] | None = None


def _save_draft(client: TestClient) -> tuple[str, dict[str, Any]]:
    state = cast(dict[str, Any], _json(client.get(_EDITOR)))
    command = dict(_example("CB-FIN-001/R1.json", "new-draft-save-command"))
    draft = state.get("draft")
    command["expectedVersion"] = draft["version"] if isinstance(draft, dict) else None
    return _DRAFT, command


def _decide_item(client: TestClient) -> tuple[str, dict[str, Any]]:
    """지금 검토를 기다리는 품목 하나를 고른다."""
    review = cast(dict[str, Any], _json(client.get(_REVIEW)))
    pending = [
        state
        for state in review["itemReviewStates"]
        if state["reviewStatus"] == "review_pending"
    ]
    assert pending, "시드에 검토 대기 품목이 없어 결정을 부를 수 없습니다."
    item_id = cast(str, pending[0]["itemId"])
    return (
        f"{_REVIEW_BASE}/items/{item_id}/review",
        {"decision": "approve", "expectedReviewStatus": "review_pending"},
    )


def _submit_revision(client: TestClient) -> tuple[str, dict[str, Any]]:
    """보완 요청을 받은 품목을 그대로 다시 낸다.

    `revisionItems`에 담겨 오는 것이 곧 보완 대상이다. 화면이 하는 일과 같다.
    """
    revision = cast(dict[str, Any], _json(client.get(_REVISION)))
    items = [
        {
            "itemId": item["itemId"],
            "expectedReviewStatus": "revision_requested",
            "content": item["content"],
        }
        for item in revision["revisionItems"]
    ]
    assert items, "시드에 보완 요청 품목이 없어 재제출을 부를 수 없습니다."
    return f"{_REVIEW_BASE}/revisions", {"items": items}


def _change_role(client: TestClient) -> tuple[str, dict[str, Any]]:
    """부원 한 명의 직급을 바꾼다. 마지막 회장단은 건드리지 않는다."""
    members = cast(dict[str, Any], _json(client.get(_MEMBER_ROLES)))
    target = next(member for member in members["members"] if member["role"] == "member")
    return (
        f"/organization/memberships/{target['membershipId']}/role",
        {"role": "department_head", "expectedCurrentRole": "member"},
    )


_EDITOR = f"/events/{EVENT}/purchase-request-editor"
_DRAFT = f"/events/{EVENT}/purchase-request-draft"
_REVIEW_BASE = f"/events/{EVENT}/purchase-requests/{REQUEST}"
_REVIEW = f"{_REVIEW_BASE}/review"
_REVISION = f"{_REVIEW_BASE}/revision"
_MEMBER_ROLES = "/organization/member-roles"

# 읽는 것을 먼저, 바꾸는 것을 나중에 둔다. 순서가 뒤집히면 바뀐 상태를 읽고
# 엉뚱한 이유로 실패한다. 시드는 검사마다 새로 깔지만 순서는 그대로 둔다 —
# 표를 읽는 사람이 무엇이 무엇에 기대는지 보아야 한다.
CALLS: dict[str, Call] = {
    "API:session.get_viewer@R1": Call("GET", "/session/viewer", FINANCE),
    "API:organization.list_member_roles@R1": Call("GET", _MEMBER_ROLES, PRESIDENT),
    "API:purchase_request.get_editor_state@R1": Call("GET", _EDITOR, FINANCE),
    "API:purchase_request.list_own@R1": Call(
        "GET", f"/events/{EVENT}/purchase-requests/mine", FINANCE
    ),
    "API:purchase_request.get_detail@R2": Call("GET", _REVIEW_BASE, FINANCE),
    "API:event_budget.get_summary@R1": Call(
        "GET", f"/events/{EVENT}/budget-summary", FINANCE
    ),
    "API:purchase_request.list_event_items@R1": Call(
        "GET", f"/events/{EVENT}/purchase-request-items", FINANCE
    ),
    "API:purchase_request.get_review@R1": Call("GET", _REVIEW, FINANCE),
    "API:purchase_request.get_revision@R1": Call("GET", _REVISION, FINANCE),
    "API:purchase_request.save_draft@R1": Call(
        "PUT", _DRAFT, FINANCE, prepare=_save_draft
    ),
    "API:purchase_request.delete_draft@R1": Call("DELETE", _DRAFT, FINANCE),
    "API:purchase_request.submit@R1": Call(
        "POST",
        f"/events/{EVENT}/purchase-requests",
        FINANCE,
        body=_example("CB-FIN-001/R1.json", "submit-multi-item-command"),
        # 제출은 같은 요청이 두 번 와도 한 번만 만들어야 한다. 계약이 이 헤더를
        # 요구하고, 없으면 422로 거절한다.
        headers={"Idempotency-Key": "contract-shape-check"},
    ),
    "API:purchase_request.decide_item@R1": Call(
        "PUT", _REVIEW, FINANCE, prepare=_decide_item
    ),
    "API:purchase_request.submit_revision@R1": Call(
        "POST", f"{_REVIEW_BASE}/revisions", FINANCE, prepare=_submit_revision
    ),
    "API:organization.change_member_role@R1": Call(
        "PUT", _MEMBER_ROLES, PRESIDENT, prepare=_change_role
    ),
}


# ---------------------------------------------------------------------------
# 실행
# ---------------------------------------------------------------------------
class _ApiGatewayContextApp:
    """게이트웨이가 검증해 넘겨주는 청구항을 흉내낸다."""

    def __init__(self, application: ASGIApp, *, subject: str) -> None:
        self._application = application
        self._event = {
            "requestContext": {
                "authorizer": {
                    "jwt": {
                        "claims": {
                            "token_use": "access",
                            "iss": seed_local.ISSUER,
                            "sub": subject,
                        }
                    }
                }
            }
        }

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            scope["aws.event"] = self._event
        await self._application(scope, receive, send)


def _json(response: Response) -> Any:
    assert response.status_code == 200, (
        f"준비 요청이 {response.status_code}로 답했습니다: {response.text[:200]}"
    )
    return response.json()


@pytest.fixture
def seeded(migrated_engine: Engine) -> Iterator[Engine]:
    """검사마다 새로 깐다. 바꾸는 요청이 다음 검사의 전제를 흔들면 안 된다."""
    seed_local.seed(migrated_engine, reset=True)
    try:
        yield migrated_engine
    finally:
        with migrated_engine.begin() as connection:
            seed_local._delete_seeded(connection)  # pyright: ignore[reportPrivateUsage]


def _client(engine: Engine, *, subject: str) -> TestClient:
    return TestClient(_ApiGatewayContextApp(create_app(engine=engine), subject=subject))


def test_every_served_contract_is_checked() -> None:
    """구현했다고 선언한 API 계약이 전부 위 표에 있는가.

    새 계약을 구현하고 이 표에 안 넣으면 여기서 실패한다. 그것이 이 파일이
    시간이 지나도 비지 않는 유일한 방법이다.
    """
    unchecked = _served_api_contract_ids() - CALLS.keys()

    assert not unchecked, (
        "서버가 구현했다고 선언했는데 응답 모양을 아무도 보지 않는 계약이 있습니다: "
        f"{sorted(unchecked)}"
    )


def test_the_table_has_no_ghosts() -> None:
    """반대쪽. 서버가 더 이상 구현하지 않는 계약이 표에 남아 있으면 지운다."""
    ghosts = CALLS.keys() - _served_api_contract_ids()

    assert not ghosts, (
        f"서버가 선언하지 않는 계약이 표에 남아 있습니다: {sorted(ghosts)}"
    )


# 아직 못 부르는 것. **계약이 틀린 것이 아니라 개발용 데이터가 그 상태를 안 만든다.**
# 표에서 지우지 않고 여기 적는다 — `strict=True`라 누군가 고치면 XPASS로 실패해서
# 이 줄을 지우라고 말한다. 조용히 남는 구멍이 되지 않는다.
BLOCKED_BY_SEED: dict[str, str] = {
    "API:purchase_request.decide_item@R1": (
        "시드에 검토 대기(review_pending) 품목이 없다. 검토 화면의 주된 행동을"
        " 개발용 데이터로 해 볼 수 없다는 뜻이기도 하다 — 시드를 고칠 일이다."
    ),
    "API:purchase_request.submit_revision@R1": (
        "시드의 보완 요청 품목을 그대로 다시 내면 422다. 보완을 요청받은 이유가"
        " 그 내용이 불완전해서이므로, 고친 내용을 만들어 넣어야 한다."
    ),
    "API:purchase_request.submit@R1": (
        "시드의 재정부 구성원이 이미 이 행사에 요청을 냈다. 초안 참조 없이 다시"
        " 내면 409다. 다른 사람은 이 행사에서 제출 권한이 없다."
    ),
}


@pytest.mark.parametrize(
    "contract_id",
    [
        pytest.param(
            contract_id,
            marks=(
                [pytest.mark.xfail(strict=True, reason=BLOCKED_BY_SEED[contract_id])]
                if contract_id in BLOCKED_BY_SEED
                else []
            ),
        )
        for contract_id in CALLS
    ],
)
def test_response_matches_the_contract(seeded: Engine, contract_id: str) -> None:
    call = CALLS[contract_id]
    client = _client(seeded, subject=call.subject)

    with client:
        path, body = call.path, call.body
        if call.prepare is not None:
            path, body = call.prepare(client)

        extra: dict[str, Any] = {}
        if body is not None:
            extra["json"] = body
        if call.headers is not None:
            extra["headers"] = call.headers
        response = cast(Response, client.request(call.method, path, **extra))

    success = _success(contract_id)
    assert response.status_code == success["http_status"], (
        f"{contract_id}: 계약은 {success['http_status']}인데 "
        f"{response.status_code}로 답했습니다. {response.text[:300]}"
    )

    body_ref = cast("str | None", success.get("body_contract_ref"))
    if body_ref is None or body_ref == EMPTY_BODY:
        assert not response.content, "본문 없는 계약인데 본문이 왔습니다."
        return

    schema = _contracts()[body_ref]["specification"]["json_schema"]
    errors = sorted(
        Draft202012Validator(schema, registry=_registry()).iter_errors(response.json()),
        key=lambda error: list(error.absolute_path),
    )

    assert not errors, "\n".join(
        [f"{contract_id}의 응답이 {body_ref}와 다릅니다."]
        + [f"  {list(e.absolute_path) or '(뿌리)'}: {e.message}" for e in errors[:8]]
    )
