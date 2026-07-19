# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# ↑ starlette TestClient의 httpx 조건부 import로 반환 타입이 Unknown이 되는 한계.
#   이 파일에만 적용. 테스트가 늘면 typed 클라이언트 헬퍼(conftest)로 대체할 것.
import httpx
from fastapi.testclient import TestClient

from vada_api.main import app

client = TestClient(app)


def test_health() -> None:
    res: httpx.Response = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
