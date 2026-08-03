from collections.abc import Mapping
from dataclasses import dataclass
from typing import cast

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


def _identity_claim(claims: Mapping[str, object], key: str) -> str:
    value = claims.get(key)
    if not isinstance(value, str) or not value or value != value.strip():
        raise UnauthenticatedError
    return value


def _string_key_mapping(value: object) -> Mapping[str, object] | None:
    if not isinstance(value, Mapping):
        return None
    return cast(Mapping[str, object], value)
