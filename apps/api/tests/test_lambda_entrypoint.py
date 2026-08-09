"""Terraform이 부르겠다고 적은 자리가 실제로 있는지 본다.

배포는 `infra/api.tf`의 `handler` 값으로 파이썬 함수를 찾는다. 그 이름을 바꾸거나
지우면 **배포는 성공하고 첫 요청에서 실패한다.** 저장소의 어떤 검사도 그 문자열과
코드를 맞춰 보지 않으면 그 사고는 배포된 뒤에야 드러난다.

조립 불변식(`test_composition.py`)과 같은 종류다. 사람이 두 곳에 적은 이름은
반드시 어긋난다.
"""

from __future__ import annotations

import importlib
import re
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[3]
TERRAFORM = REPOSITORY_ROOT / "infra" / "api.tf"


def _declared_handler() -> str:
    source = TERRAFORM.read_text(encoding="utf-8")
    match = re.search(r'^\s*handler\s*=\s*"([^"]+)"', source, re.MULTILINE)
    assert match, f"{TERRAFORM}에 handler 선언이 없습니다."
    return match.group(1)


def test_terraform_points_at_a_handler_that_exists() -> None:
    declared = _declared_handler()

    module_path, _, attribute = declared.rpartition(".")
    module = importlib.import_module(module_path)

    assert hasattr(module, attribute), (
        f"infra/api.tf가 {declared}를 부르겠다고 적었는데 그 자리가 없습니다."
    )
    assert callable(getattr(module, attribute))


def test_the_handler_hands_the_gateway_event_to_the_auth_boundary() -> None:
    """Mangum이 원본 이벤트를 `scope["aws.event"]`에 넣는다.

    인증 경계가 읽는 자리가 정확히 거기다. 어댑터를 바꾸면 그 약속이 깨지고,
    깨진 것은 권한 판정이 전부 실패하는 모습으로만 드러난다.
    """
    from mangum import Mangum

    from vada_api.main import handler

    assert isinstance(handler, Mangum)
