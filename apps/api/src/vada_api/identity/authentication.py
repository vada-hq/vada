from collections.abc import Mapping
from dataclasses import dataclass
from typing import cast

from fastapi import Request

from vada_api.identity.errors import UnauthenticatedError


@dataclass(frozen=True, slots=True)
class CognitoPrincipal:
    """Stable Cognito identity, scoped by issuer as well as subject."""

    issuer: str
    subject: str


def principal_from_api_gateway_request_context(
    request_context: Mapping[str, object],
) -> CognitoPrincipal:
    """Read claims that API Gateway's JWT authorizer has already verified.

    Raw bearer tokens are intentionally not accepted here. API Gateway owns
    signature, issuer, audience and expiry validation; this boundary only
    accepts its authorizer result and the minimal Cognito access-token claims.
    """

    authorizer = _string_key_mapping(request_context.get("authorizer"))
    jwt = _string_key_mapping(authorizer.get("jwt")) if authorizer else None
    claims = _string_key_mapping(jwt.get("claims")) if jwt else None
    if claims is None or claims.get("token_use") != "access":
        raise UnauthenticatedError

    issuer = _identity_claim(claims, "iss")
    subject = _identity_claim(claims, "sub")
    return CognitoPrincipal(issuer=issuer, subject=subject)


def api_gateway_request_context(request: Request) -> Mapping[str, object]:
    """API Gateway가 실어 보낸 요청 맥락만 꺼낸다.

    없으면 빈 것을 준다. 여기서 비었다고 통과시키지 않는다 —
    `principal_from_api_gateway_request_context`가 청구항이 없다고 거절한다.
    """

    raw_event = request.scope.get("aws.event")
    if not isinstance(raw_event, Mapping):
        return {}
    event = cast(Mapping[str, object], raw_event)
    raw_context = event.get("requestContext")
    if not isinstance(raw_context, Mapping):
        return {}
    return cast(Mapping[str, object], raw_context)


def _identity_claim(claims: Mapping[str, object], key: str) -> str:
    value = claims.get(key)
    if not isinstance(value, str) or not value or value != value.strip():
        raise UnauthenticatedError
    return value


def _string_key_mapping(value: object) -> Mapping[str, object] | None:
    if not isinstance(value, Mapping):
        return None
    return cast(Mapping[str, object], value)
