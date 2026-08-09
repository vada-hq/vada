from __future__ import annotations

import os
import shutil
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from docker.errors import DockerException
from sqlalchemy import Engine, create_engine, inspect, text
from testcontainers.community.postgres import PostgresContainer

API_ROOT = Path(__file__).parents[2]


def alembic_config(database_url: str | None = None) -> Config:
    config = Config(str(API_ROOT / "alembic.ini"))
    if database_url is not None:
        config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    explicit_url = os.getenv("VADA_TEST_DATABASE_URL")
    if explicit_url:
        yield explicit_url
        return

    if shutil.which("docker") is None:
        pytest.skip(
            "PostgreSQL integration blocked: set VADA_TEST_DATABASE_URL to a "
            "disposable empty database or install Docker with a running daemon."
        )

    try:
        with PostgresContainer("postgres:17-alpine", driver="psycopg") as postgres:
            yield postgres.get_connection_url()
    except DockerException as error:
        pytest.skip(f"PostgreSQL integration blocked by Docker: {error}")


@pytest.fixture(scope="session")
def migrated_engine(postgres_url: str) -> Iterator[Engine]:
    engine = create_engine(postgres_url)
    existing_tables = set(inspect(engine).get_table_names())
    assert not existing_tables, (
        "VADA_TEST_DATABASE_URL must point to a disposable empty PostgreSQL database; "
        f"found {sorted(existing_tables)}"
    )

    command.upgrade(alembic_config(postgres_url), "head")
    try:
        yield engine
    finally:
        # 우리가 만든 것을 되돌린다. 없으면 **두 번째 실행부터 실패한다** —
        # 위의 "비어 있어야 한다"에 지난 실행이 남긴 표가 걸린다.
        #
        # CI는 컨테이너가 매번 새로 떠서 이것 없이도 됐다. 그래서 없었고, 그
        # 차이가 로컬을 "한 번만 돌릴 수 있는" 곳으로 만들었다. Docker를 쓰지
        # 않는 기계에서는 이것이 실제로 막는 벽이다(이슈 #51).
        #
        # 지우는 것은 전부 이 실행이 만든 것이다. 시작할 때 비어 있음을 이미
        # 확인했다.
        try:
            command.downgrade(alembic_config(postgres_url), "base")
            # `downgrade base`는 리비전 표까지 지우지는 않는다. 그 한 줄이
            # 남으면 다음 실행이 위의 "비어 있어야 한다"에 걸린다.
            with engine.begin() as connection:
                connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        finally:
            engine.dispose()
