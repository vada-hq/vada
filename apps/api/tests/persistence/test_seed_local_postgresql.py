"""시드가 실제 PostgreSQL의 계약을 통과하는지 본다.

문장이 컴파일되는 것과 데이터베이스가 받아 주는 것은 다른 사실이다. 품목의
가격 근거와 유형별 상세는 PostgreSQL 안의 함수가 판정한다 — 파이썬 쪽에서는
보이지 않는다.

실제로 시드가 컴파일 검사 일곱 건을 전부 통과한 뒤 첫 실행에서 거부당했다.
대여 품목의 상세에 계약에 없는 키를 넣었고, 가격 근거를 비워 뒀다. 둘 다
데이터베이스만 아는 사실이었다.
"""

from __future__ import annotations

import pytest
import sqlalchemy as sa
from scripts import seed_local
from sqlalchemy import Engine

pytestmark = pytest.mark.postgres


def test_the_seed_satisfies_the_contract_stored_in_the_database(
    migrated_engine: Engine,
) -> None:
    try:
        seed_local.seed(migrated_engine, reset=True)

        with migrated_engine.begin() as connection:
            items = connection.scalar(
                sa.select(sa.func.count())
                .select_from(seed_local.purchase_request_items)
                .where(
                    seed_local.purchase_request_items.c.organization_id
                    == seed_local.ORGANIZATION
                )
            )
        assert items == len(seed_local.items())
    finally:
        # 세션이 공유하는 데이터베이스다. 넣은 것을 도로 걷어낸다.
        with migrated_engine.begin() as connection:
            seed_local._delete_seeded(connection)  # pyright: ignore[reportPrivateUsage]
